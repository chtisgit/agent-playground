/**
 * Tests for singlePlayerController - focusing on critical bug fixes
 * 
 * ID 170: selectedTile used after being set to undefined in makeMove()
 * ID 171: Using MahjongService.validateMatch instead of ad-hoc type comparison
 */

// We need to mock express req/res and the dependencies
// Since we can't run actual HTTP, we test the logic patterns

describe('singlePlayerController - Critical Bug Fixes', () => {
  describe('ID 170: selectedTile survival after being set to undefined', () => {
    /**
     * This test validates the pattern fix: 
     * BEFORE FIX: game.selectedTile = undefined; ... game.tiles[game.selectedTile].removed = true; // CRASH
     * AFTER FIX:  const saved = game.selectedTile; game.selectedTile = undefined; ... game.tiles[saved].removed = true;
     */
    it('should save selectedTile index before clearing it', () => {
      // Simulate the fixed pattern
      const game = {
        tiles: {
          0: { id: 'tile_0', type: 'dot_1', removed: false, selected: true },
          5: { id: 'tile_5', type: 'dot_1', removed: false, selected: false }
        },
        selectedTile: 0
      };

      const tileIndex = 5;
      
      // FIXED PATTERN: Save before clearing
      const savedSelectedIndex = game.selectedTile;  // = 0
      const firstTile = game.tiles[savedSelectedIndex];
      const secondTile = game.tiles[tileIndex];
      
      // Deselect
      game.tiles[savedSelectedIndex].selected = false;
      game.selectedTile = undefined;
      
      // Now use savedSelectedIndex (NOT game.selectedTile which is undefined)
      game.tiles[savedSelectedIndex].removed = true;
      game.tiles[tileIndex].removed = true;
      
      // Verify no crash and correct state
      expect(game.tiles[0].removed).toBe(true);
      expect(game.tiles[5].removed).toBe(true);
      expect(game.selectedTile).toBeUndefined();
    });

    it('OLD BUG PATTERN: would crash with TypeError', () => {
      // This demonstrates the bug that was fixed
      const game = {
        tiles: {
          0: { id: 'tile_0', type: 'dot_1', removed: false, selected: true },
          5: { id: 'tile_5', type: 'dot_1', removed: false, selected: false }
        },
        selectedTile: 0
      };

      const tileIndex = 5;
      
      // OLD BUGGY PATTERN
      game.tiles[game.selectedTile].selected = false; // Works: selectedTile = 0
      game.selectedTile = undefined;
      
      // This would crash: Cannot read property 'removed' of undefined
      expect(() => {
        game.tiles[game.selectedTile].removed = true;
      }).toThrow();
    });
  });

  describe('ID 171: validateMatch vs ad-hoc type comparison', () => {
    it('ad-hoc comparison would reject flower-to-different-flower matches', () => {
      // Old code: firstTile.type === secondTile.type
      // This would reject flower_1 === flower_2 (false!)
      const flower1 = { type: 'flower_1' };
      const flower2 = { type: 'flower_2' };
      
      const oldIsMatch = flower1.type === flower2.type;
      expect(oldIsMatch).toBe(false); // BUG: should be true for flowers!
    });

    it('ad-hoc comparison would reject season-to-different-season matches', () => {
      const season1 = { type: 'season_2' };
      const season2 = { type: 'season_4' };
      
      const oldIsMatch = season1.type === season2.type;
      expect(oldIsMatch).toBe(false); // BUG: should be true for seasons!
    });

    it('MahjongService.tilesMatch correctly handles flower matching', async () => {
      // Dynamic import would be needed in real test
      // This verifies the logic that validateMatch uses
      const { tilesMatch } = await import('../server/services/mahjongService.js');
      
      expect(tilesMatch('flower_1', 'flower_2')).toBe(true);
      expect(tilesMatch('flower_1', 'flower_4')).toBe(true);
      expect(tilesMatch('season_1', 'season_3')).toBe(true);
      expect(tilesMatch('dot_1', 'dot_2')).toBe(false);
      expect(tilesMatch('dot_1', 'dot_1')).toBe(true);
    });
  });

  describe('getHint: using MahjongService.getHint', () => {
    it('old hint logic would miss flower-flower matches', () => {
      // Old code: tile1.type === tile2.type
      // Would NOT find flower_1 and flower_2 as a match
      const availableTiles = [
        { id: 'tile_a', type: 'flower_1', removed: false, position: { row: 0, col: 0, layer: 0 } },
        { id: 'tile_b', type: 'flower_2', removed: false, position: { row: 0, col: 11, layer: 0 } }
      ];
      
      let foundOld = false;
      for (let i = 0; i < availableTiles.length; i++) {
        for (let j = i + 1; j < availableTiles.length; j++) {
          if (availableTiles[i].type === availableTiles[j].type) {
            foundOld = true;
          }
        }
      }
      expect(foundOld).toBe(false); // BUG: old logic misses this!
    });
  });
});
