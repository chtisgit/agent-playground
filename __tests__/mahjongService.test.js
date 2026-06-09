/**
 * Tests for MahjongService
 * 
 * Validates core game logic: match validation, tile blocking, hint generation
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
  getSelectableTiles
} from '../server/services/mahjongService.js';

describe('MahjongService', () => {
  describe('generateBoard', () => {
    it('should generate a board with 144 tiles', () => {
      const { tiles, positions } = generateBoard('medium');
      expect(Object.keys(tiles).length).toBe(144);
      expect(Object.keys(positions).length).toBe(144);
    });

    it('should generate tiles with valid types', () => {
      const { tiles } = generateBoard('medium');
      const validPrefixes = ['dot_', 'bam_', 'char_', 'wind_', 'dragon_', 'flower_', 'season_'];
      Object.values(tiles).forEach(type => {
        expect(validPrefixes.some(prefix => type.startsWith(prefix))).toBe(true);
      });
    });

    it('should have positions with row, col, and layer properties', () => {
      const { positions } = generateBoard('easy');
      Object.values(positions).forEach(pos => {
        expect(pos).toHaveProperty('row');
        expect(pos).toHaveProperty('col');
        expect(pos).toHaveProperty('layer');
      });
    });
  });

  describe('tilesMatch', () => {
    it('should match identical tile types', () => {
      expect(tilesMatch('dot_1', 'dot_1')).toBe(true);
      expect(tilesMatch('bam_5', 'bam_5')).toBe(true);
      expect(tilesMatch('wind_east', 'wind_east')).toBe(true);
    });

    it('should not match different tile types', () => {
      expect(tilesMatch('dot_1', 'dot_2')).toBe(false);
      expect(tilesMatch('bam_1', 'char_1')).toBe(false);
      expect(tilesMatch('wind_east', 'wind_south')).toBe(false);
    });

    it('should match any flower with any flower (ID 171)', () => {
      expect(tilesMatch('flower_1', 'flower_2')).toBe(true);
      expect(tilesMatch('flower_3', 'flower_4')).toBe(true);
      expect(tilesMatch('flower_1', 'flower_1')).toBe(true);
    });

    it('should match any season with any season (ID 171)', () => {
      expect(tilesMatch('season_1', 'season_2')).toBe(true);
      expect(tilesMatch('season_3', 'season_4')).toBe(true);
      expect(tilesMatch('season_1', 'season_1')).toBe(true);
    });

    it('should not match flower with season', () => {
      expect(tilesMatch('flower_1', 'season_1')).toBe(false);
    });

    it('should not match flower with numbered tile', () => {
      expect(tilesMatch('flower_1', 'dot_1')).toBe(false);
    });
  });

  describe('isTileBlocked', () => {
    it('should detect tile blocked by layer above', () => {
      const positions = {
        'tile_0': { row: 2, col: 4, layer: 0 },
        'tile_1': { row: 2, col: 4, layer: 1 }
      };
      expect(isTileBlocked('tile_0', positions)).toBe(true);
      expect(isTileBlocked('tile_1', positions)).toBe(false);
    });

    it('should detect tile blocked by left neighbor', () => {
      const positions = {
        'tile_0': { row: 2, col: 3, layer: 0 },
        'tile_1': { row: 2, col: 4, layer: 0 }
      };
      expect(isTileBlocked('tile_1', positions)).toBe(true);
    });

    it('should detect tile blocked by right neighbor', () => {
      const positions = {
        'tile_0': { row: 2, col: 4, layer: 0 },
        'tile_1': { row: 2, col: 5, layer: 0 }
      };
      expect(isTileBlocked('tile_0', positions)).toBe(true);
    });

    it('should return false for unblocked tile', () => {
      const positions = {
        'tile_0': { row: 2, col: 0, layer: 0 }  // left edge, no right neighbor
      };
      expect(isTileBlocked('tile_0', positions)).toBe(false);
    });
  });

  describe('validateMatch', () => {
    it('should validate matching identical types', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_1' };
      const positions = {
        'tile_0': { row: 0, col: 0, layer: 0 },
        'tile_1': { row: 0, col: 11, layer: 0 }
      };
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_1')).toBe(true);
    });

    it('should reject non-matching types', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_2' };
      const positions = {
        'tile_0': { row: 0, col: 0, layer: 0 },
        'tile_1': { row: 0, col: 11, layer: 0 }
      };
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_1')).toBe(false);
    });

    it('should reject blocked tiles', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_1' };
      const positions = {
        'tile_0': { row: 0, col: 5, layer: 0 },
        'tile_1': { row: 0, col: 6, layer: 0 }  // blocked by tile_0 on left
      };
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_1')).toBe(false);
    });

    it('should validate flower-to-flower matching (ID 171)', () => {
      const tiles = { 'tile_0': 'flower_1', 'tile_1': 'flower_3' };
      const positions = {
        'tile_0': { row: 0, col: 0, layer: 0 },
        'tile_1': { row: 0, col: 11, layer: 0 }
      };
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_1')).toBe(true);
    });

    it('should validate season-to-season matching (ID 171)', () => {
      const tiles = { 'tile_0': 'season_2', 'tile_1': 'season_4' };
      const positions = {
        'tile_0': { row: 0, col: 0, layer: 0 },
        'tile_1': { row: 0, col: 11, layer: 0 }
      };
      expect(validateMatch(tiles, positions, 'tile_0', 'tile_1')).toBe(true);
    });
  });

  describe('getHint', () => {
    it('should find a valid matching pair', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_1', 'tile_2': 'dot_2' };
      const positions = {
        'tile_0': { row: 0, col: 0, layer: 0 },
        'tile_1': { row: 0, col: 11, layer: 0 },
        'tile_2': { row: 2, col: 5, layer: 0 }  // blocked by neighbors
      };
      const hint = getHint(tiles, positions);
      expect(hint).not.toBeNull();
      expect([hint.tile1Id, hint.tile2Id]).toContain('tile_0');
      expect([hint.tile1Id, hint.tile2Id]).toContain('tile_1');
    });

    it('should return null when no valid moves exist', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_2' };
      const positions = {
        'tile_0': { row: 0, col: 4, layer: 0 },
        'tile_1': { row: 0, col: 5, layer: 0 }  // blocked
      };
      const hint = getHint(tiles, positions);
      expect(hint).toBeNull();
    });
  });

  describe('removeTiles', () => {
    it('should remove matched tiles from state', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_1', 'tile_2': 'dot_2' };
      const positions = {
        'tile_0': { row: 0, col: 0, layer: 0 },
        'tile_1': { row: 0, col: 11, layer: 0 },
        'tile_2': { row: 2, col: 5, layer: 0 }
      };
      const result = removeTiles(tiles, positions, 'tile_0', 'tile_1');
      expect(result.tiles).not.toHaveProperty('tile_0');
      expect(result.tiles).not.toHaveProperty('tile_1');
      expect(result.tiles).toHaveProperty('tile_2');
      expect(result.positions).not.toHaveProperty('tile_0');
      expect(result.positions).not.toHaveProperty('tile_1');
    });
  });

  describe('hasValidMoves', () => {
    it('should return true when valid moves exist', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_1' };
      const positions = {
        'tile_0': { row: 0, col: 0, layer: 0 },
        'tile_1': { row: 0, col: 11, layer: 0 }
      };
      expect(hasValidMoves(tiles, positions)).toBe(true);
    });

    it('should return false when no valid moves', () => {
      const tiles = { 'tile_0': 'dot_1', 'tile_1': 'dot_2' };
      const positions = {
        'tile_0': { row: 0, col: 4, layer: 0 },
        'tile_1': { row: 0, col: 5, layer: 0 }  // blocked
      };
      expect(hasValidMoves(tiles, positions)).toBe(false);
    });
  });

  describe('calculateScore', () => {
    it('should return higher scores for harder difficulties', () => {
      const easy = calculateScore('easy', 10, 100);
      const medium = calculateScore('medium', 10, 100);
      const hard = calculateScore('hard', 10, 100);
      expect(medium).toBeGreaterThan(easy);
      expect(hard).toBeGreaterThan(medium);
    });

    it('should decrease with more moves', () => {
      const scoreFew = calculateScore('medium', 5, 100);
      const scoreMany = calculateScore('medium', 50, 100);
      expect(scoreFew).toBeGreaterThan(scoreMany);
    });
  });
});
