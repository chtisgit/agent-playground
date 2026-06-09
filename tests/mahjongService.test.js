/**
 * Tests for MahjongService - Core game logic
 */
import { 
  MahjongService,
  generateBoard,
  validateMatch,
  getHint,
  hasValidMoves,
  removeTiles,
  calculateScore,
  tilesMatch,
  isTileBlocked,
  getSelectableTiles,
  buildPositionGrid,
  isTileBlockedFast
} from '../server/services/mahjongService.js';

describe('MahjongService', () => {
  describe('tilesMatch', () => {
    test('identical tiles match', () => {
      expect(tilesMatch('dot_1', 'dot_1')).toBe(true);
      expect(tilesMatch('bam_5', 'bam_5')).toBe(true);
      expect(tilesMatch('wind_east', 'wind_east')).toBe(true);
    });

    test('different tiles do not match', () => {
      expect(tilesMatch('dot_1', 'dot_2')).toBe(false);
      expect(tilesMatch('bam_5', 'char_5')).toBe(false);
    });

    test('any flowers match each other', () => {
      expect(tilesMatch('flower_1', 'flower_2')).toBe(true);
      expect(tilesMatch('flower_3', 'flower_4')).toBe(true);
    });

    test('any seasons match each other', () => {
      expect(tilesMatch('season_1', 'season_2')).toBe(true);
      expect(tilesMatch('season_3', 'season_4')).toBe(true);
    });

    test('flowers do not match seasons', () => {
      expect(tilesMatch('flower_1', 'season_1')).toBe(false);
    });
  });

  describe('isTileBlocked', () => {
    test('tile not in positions is blocked', () => {
      expect(isTileBlocked('nonexistent', {})).toBe(true);
    });

    test('isolated tile is not blocked', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 5, col: 5, layer: 0 },
      };
      expect(isTileBlocked('tile_0', positions)).toBe(false);
    });

    test('tile with neighbour on left is blocked', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 0, col: 1, layer: 0 },
      };
      expect(isTileBlocked('tile_1', positions)).toBe(true);
    });

    test('tile with neighbour on right is blocked', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 0, col: 1, layer: 0 },
      };
      expect(isTileBlocked('tile_0', positions)).toBe(true);
    });

    test('tile with tile directly on top is blocked', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 0, col: 0, layer: 1 },
      };
      expect(isTileBlocked('tile_0', positions)).toBe(true);
    });
  });

  describe('isTileBlockedFast', () => {
    test('uses grid for same results as slow version', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 0, col: 1, layer: 0 },
        tile_2: { row: 1, col: 0, layer: 0 },
      };
      const grid = buildPositionGrid(positions);
      
      for (const tileId of Object.keys(positions)) {
        expect(isTileBlockedFast(tileId, positions, grid))
          .toBe(isTileBlocked(tileId, positions));
      }
    });
  });

  describe('generateBoard', () => {
    test('generates 144 tiles and 144 positions', () => {
      const { tiles, positions } = generateBoard('medium');
      const tileKeys = Object.keys(tiles);
      const posKeys = Object.keys(positions);
      
      expect(tileKeys.length).toBe(144);
      expect(posKeys.length).toBe(144);
      // Every position should have a tile
      posKeys.forEach(key => {
        expect(tiles[key]).toBeDefined();
      });
    });

    test('generates same layout regardless of difficulty', () => {
      const easy = generateBoard('easy');
      const hard = generateBoard('hard');
      expect(Object.keys(easy.positions).length).toBe(144);
      expect(Object.keys(hard.positions).length).toBe(144);
    });
  });

  describe('validateMatch', () => {
    test('rejects blocked tiles', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 0, col: 0, layer: 1 }, // on top of tile_0
        tile_2: { row: 0, col: 1, layer: 0 },
      };
      const tiles = {
        tile_0: 'dot_1',
        tile_1: 'dot_1',
        tile_2: 'dot_1',
      };
      // tile_0 is blocked by tile_1 on top
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_2')).toBe(false);
    });

    test('accepts valid unblocked match', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 5, col: 5, layer: 0 },
      };
      const tiles = {
        tile_0: 'dot_1',
        tile_1: 'dot_1',
      };
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_1')).toBe(true);
    });

    test('rejects non-matching tiles', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 5, col: 5, layer: 0 },
      };
      const tiles = {
        tile_0: 'dot_1',
        tile_1: 'dot_2',
      };
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_1')).toBe(false);
    });
  });

  describe('getHint', () => {
    test('finds valid pair among unblocked tiles', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 5, col: 5, layer: 0 },
      };
      const tiles = {
        tile_0: 'dot_1',
        tile_1: 'dot_1',
      };
      const hint = getHint(tiles, positions);
      expect(hint).not.toBeNull();
      expect([hint.tile1Id, hint.tile2Id].sort()).toEqual(['tile_0', 'tile_1']);
    });

    test('returns null when no valid moves', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
      };
      const tiles = {
        tile_0: 'dot_1',
      };
      const hint = getHint(tiles, positions);
      expect(hint).toBeNull();
    });
  });

  describe('hasValidMoves', () => {
    test('returns true when moves exist', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 5, col: 5, layer: 0 },
      };
      const tiles = { tile_0: 'dot_1', tile_1: 'dot_1' };
      expect(hasValidMoves(tiles, positions)).toBe(true);
    });

    test('returns false when no moves exist', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 5, col: 5, layer: 0 },
      };
      const tiles = { tile_0: 'dot_1', tile_1: 'dot_2' };
      expect(hasValidMoves(tiles, positions)).toBe(false);
    });
  });

  describe('removeTiles', () => {
    test('removes two tiles and their positions', () => {
      const tiles = { tile_0: 'dot_1', tile_1: 'dot_1', tile_2: 'dot_2' };
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 1, col: 0, layer: 0 },
        tile_2: { row: 2, col: 0, layer: 0 },
      };
      const result = removeTiles(tiles, positions, 'tile_0', 'tile_1');
      expect(result.tiles).toEqual({ tile_2: 'dot_2' });
      expect(Object.keys(result.positions)).toEqual(['tile_2']);
    });
  });

  describe('calculateScore', () => {
    test('easy difficulty gives lower base score', () => {
      const easy = calculateScore('easy', 50, 100);
      const hard = calculateScore('hard', 50, 100);
      expect(hard).toBeGreaterThan(easy);
    });

    test('fewer moves give higher score', () => {
      const fewerMoves = calculateScore('medium', 10, 100);
      const moreMoves = calculateScore('medium', 90, 100);
      expect(fewerMoves).toBeGreaterThan(moreMoves);
    });
  });

  describe('getSelectableTiles', () => {
    test('returns only unblocked tiles', () => {
      const positions = {
        tile_0: { row: 0, col: 0, layer: 0 },
        tile_1: { row: 0, col: 1, layer: 0 }, // left neighbour of tile_2
        tile_2: { row: 0, col: 2, layer: 0 }, // blocked by tile_1
        tile_3: { row: 5, col: 5, layer: 0 }, // isolated, unblocked
      };
      const tiles = ['tile_0', 'tile_1', 'tile_2', 'tile_3'];
      const selectable = getSelectableTiles(tiles, positions);
      
      // tile_2 is blocked (has left neighbour), tile_0 and tile_1 are blocked by each other
      // tile_3 is isolated
      expect(selectable).toContain('tile_3');
      expect(selectable).not.toContain('tile_2');
    });
  });
});
