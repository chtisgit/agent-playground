import { Router } from 'express';
import { register, login, logout, getProfile, updateProfile, getStats } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/stats', authenticate, getStats);
router.post('/logout', authenticate, logout);

export default router;
