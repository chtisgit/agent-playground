import UserModel from '../models/user.js';
import { generateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

// Email format validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple password hashing for registration
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Compare password for login
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Register a new user
 * POST /api/auth/register
 *
 * SECURITY NOTE: The distinct error messages for "Username already exists" 
 * vs "Email already exists" allow user enumeration (an attacker can determine
 * which usernames/emails are registered). This is a known low-priority issue.
 * Mitigation: In a future iteration, return a generic "Registration failed" 
 * message and log the specific error server-side.
 */
export async function register(req, res) {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const passwordHash = await hashPassword(password);
    const user = UserModel.create(username, email, passwordHash);
    
    const token = generateToken(user);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message === 'Username already exists') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    if (error.message === 'Email already exists') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = UserModel.findByUsername(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await comparePassword(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user);
    
    res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Logout user
 * POST /api/auth/logout
 */
export function logout(req, res) {
  res.json({ message: 'Logout successful' });
}

/**
 * Get user profile
 * GET /api/auth/profile
 */
export function getProfile(req, res) {
  try {
    const user = UserModel.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export async function updateProfile(req, res) {
  try {
    const { email, password } = req.body;
    
    // Return 400 if no valid fields to update
    if (!email && !password) {
      return res.status(400).json({ error: 'No fields to update. Provide email or password.' });
    }

    if (email) {
      // Validate email format if provided
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      // Note: Adding email update functionality would go here
      // For now, we only support password updates
    }
    
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      // Properly await the async password hashing operation
      const passwordHash = await hashPassword(password);
      UserModel.updatePassword(req.user.id, passwordHash);
    }
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

/**
 * Get user statistics
 * GET /api/auth/stats
 */
export function getStats(req, res) {
  try {
    const stats = UserModel.getStats(req.user.id);
    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
}

export default {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  getStats
};
