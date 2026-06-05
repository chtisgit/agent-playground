import { Router } from 'express';
import { 
  startSinglePlayer,
  saveGame, 
  loadGame, 
  resumeGame, 
  updateGame, 
  deleteGame, 
  completeGame, 
  getHistory, 
  getLeaderboard,
  generateGame,
  validateMatch,
  getHint
} from '../controllers/gameController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Single-player game routes
router.post('/single-player', startSinglePlayer);

// Game state management
router.post('/save', saveGame);
router.get('/load/:stateId', loadGame);
router.get('/resume', resumeGame);
router.put('/update/:stateId', updateGame);
router.delete('/delete/:stateId', deleteGame);

// Game completion and stats
router.post('/complete', completeGame);
router.get('/history', getHistory);
router.get('/leaderboard', getLeaderboard);

// Game logic
router.post('/generate', generateGame);
router.post('/validate', validateMatch);
router.post('/hint', getHint);

export default router;
