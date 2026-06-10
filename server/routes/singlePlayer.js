import { Router } from 'express';
import { 
  startSinglePlayerGame,
  getGameState,
  makeMove,
  getHint,
  shuffleBoard,
  endGame
} from '../controllers/singlePlayerController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Single player game routes
router.post('/single-player', startSinglePlayerGame);
router.get('/:gameId', getGameState);
router.post('/:gameId/move', makeMove);
router.get('/:gameId/hint', getHint);
router.post('/:gameId/shuffle', shuffleBoard);
router.post('/:gameId/end', endGame);

export default router;
