# Mahjong Game Improvement List

Reviewed on main @ de3ac1756f32b346ce573014545efc5774ffd603

---

## CRITICAL BUGS (5)

1. **Board layout generates 130 positions but game expects 144 tiles.**
   - File: `server/services/mahjongService.js` (generateLayout)
   - Fix: Redesign layout to correctly hold 144 tiles in a traditional turtle pattern.
   - Branch suggestion: `fix/board-layout-144-tiles`

2. **isTileBlocked() uses O(n) full scan instead of coordinate-based lookup.**
   - File: `server/services/mahjongService.js` (isTileBlocked)
   - Fix: Use direct position-map lookup for left/right blocking instead of iterating all tiles.
   - Branch suggestion: `fix/tile-blocking-logic`

3. **SinglePlayer.jsx lacks explicit victory/win condition UI.**
   - File: `src/pages/SinglePlayer.jsx`
   - Fix: Add a win/victory screen with score summary when the board is cleared.
   - Branch suggestion: `fix/victory-screen`

4. **Vite proxy port (3001) mismatches actual server port (3000).**
   - File: `vite.config.js`
   - Fix: Change `target: 'http://localhost:3001'` to `target: 'http://localhost:3000'`.
   - Branch suggestion: `fix/vite-proxy-port`

5. **Move endpoint doesn't call MahjongService.validateMatch() or enforce blocking.**
   - File: `server/routes/games.js` (`POST /:gameId/move`)
   - Fix: Integrate MahjongService.validateMatch() and isTileBlocked() so any two tiles can't be matched regardless of board position.
   - Branch suggestion: `fix/move-validation`

---

## SECURITY ISSUES (4)

6. **Hardcoded JWT_SECRET in backend/.env committed to repo.**
   - File: `backend/.env`
   - Fix: Ensure `.env` is in `.gitignore` and remove/rotate the secret.
   - Branch suggestion: `fix/remove-hardcoded-jwt`

7. **chat_message XSS sanitization in Socket.IO is regex-only and bypassable.**
   - File: `server/index.js` (socket.on('chat_message'))
   - Fix: Use a proper XSS library (e.g., `dompurify`) for sanitization.
   - Branch suggestion: `fix/xss-chat-sanitization`

8. **CORS allowedOrigins in development is too permissive.**
   - File: `server/index.js` (getAllowedOrigins)
   - Fix: Tighten dev CORS policy.
   - Branch suggestion: `fix/cors-limits`

9. **Database constraint mismatch — game_type and result values differ from schema.**
   - Files: `server/models/database.js` (schema), `server/routes/games.js` (code using 'singlePlayer' and 'abandoned')
   - Fix: Align all game_type values to match the CHECK constraint: ('single', 'multi'). Align result to ('win', 'loss', 'draw').
   - Branch suggestion: `fix/db-constraint-alignment`

---

## ARCHITECTURAL / CODE QUALITY (5)

10. **Dead/duplicate backend/ directory with orphaned PostgreSQL code.**
    - Fix: Remove `backend/` directory and consolidate remaining useful code into `server/`.
    - Branch suggestion: `chore/cleanup-backend-dir`

11. **No rate-limiting middleware anywhere.**
    - File: `server/index.js`
    - Fix: Add `express-rate-limit` for auth and game endpoints.
    - Branch suggestion: `fix/rate-limiting`

12. **Inconsistent naming: game_type uses 'singlePlayer', 'single', 'active-game'.**
    - Files across server/controllers/, server/routes/, server/models/
    - Fix: Standardize to one convention across all files.
    - Branch suggestion: `fix/game-type-naming`

13. **Guest user session lost on refresh because guestId is randomized per request.**
    - File: `server/routes/games.js` (guestUser middleware)
    - RESOLVED in commit 8912fe4 — uses deterministic hash.
    - Verify during review.

14. **No Express global error handler.**
    - File: `server/index.js`
    - Fix: Add `app.use((err, req, res, next) => ...)` to catch and sanitize unhandled errors.
    - Branch suggestion: `fix/global-error-handler`

---

## TESTING GAPS (6)

15. **Zero test files exist in the repository.**
16. **Jest listed in devDependencies but no jest.config.js.**
17. **No Socket.IO integration tests.**
18. **No MahjongService unit tests.**
19. **No auth middleware tests.**
20. **No frontend component tests.**
    - Branch suggestions: `test/mahjong-service`, `test/auth-middleware`, `test/game-controller`, `test/socket-io`, `test/react-components`

---

## FEATURE / UX IMPROVEMENTS (3)

21. **Difficulty parameter is accepted but never changes actual gameplay.**
    - File: `server/services/mahjongService.js` (generateBoard)
    - Fix: Make difficulty affect board complexity, tile distribution, or hint availability.
    - Branch suggestion: `feat/difficulty-levels`

22. **"Resume saved game" API exists but frontend is not wired.**
    - Files: `src/pages/Profile.jsx`, `src/pages/Login.jsx`
    - Fix: Hook up frontend to call `/api/games/resume` and load saved state.
    - Branch suggestion: `feat/resume-game-frontend`

23. **Tile.jsx symbol mapping broken.**
    - File: `src/components/Tile.jsx`
    - Fix: Map backend tile strings (e.g. 'dot_1') to correct frontend symbols.
    - Branch suggestion: `fix/tile-symbol-mapping`

---

## MERGE DISCIPLINE

Only the Maintainer (Linus Bobwald) merges to `main`.
Branch review pipeline:
1. Push branch to `origin/<branch-name>`.
2. Security Specialist (Stefan) reviews and approves.
3. Test Engineer (Jebediah) confirms tests pass.
4. Maintainer reviews and merges to `main`.
