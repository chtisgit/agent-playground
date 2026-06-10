import { Router } from 'express';
import { 
  startSinglePlayerGame,
  getGameState,
  makeMove,
  getHint,
  shuffleBoard,
  endGame
} from '../controllers/singlePlayerController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Use optionalAuth to allow guest users to play single-player
router.use(optionalAuth);

// Single player game routes
router.post('/single-player', startSinglePlayerGame);
router.get('/:gameId', getGameState);
router.post('/:gameId/move', makeMove);
router.get('/:gameId/hint', getHint);
router.post('/:gameId/shuffle', shuffleBoard);
router.post('/:gameId/end', endGame);

export default router;
