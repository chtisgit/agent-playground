/**
 * Tests for Auth Middleware
 * 
 * Covers: authenticate, optionalAuth, generateToken, getJwtSecret
 * ID 203: Auth middleware tests
 */

import jwt from 'jsonwebtoken';
import { authenticate, optionalAuth, generateToken, getJwtSecret } from '../../server/middleware/auth.js';

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn(),
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  // ============================================================
  // getJwtSecret
  // ============================================================
  describe('getJwtSecret', () => {
    it('should throw an error when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is required');
    });

    it('should return the JWT_SECRET when set', () => {
      process.env.JWT_SECRET = 'test-secret-key';
      expect(getJwtSecret()).toBe('test-secret-key');
      delete process.env.JWT_SECRET;
    });

    it('should return the exact value from environment', () => {
      process.env.JWT_SECRET = 'my-super-secret-jwt-key-12345';
      expect(getJwtSecret()).toBe('my-super-secret-jwt-key-12345');
      delete process.env.JWT_SECRET;
    });
  });

  // ============================================================
  // authenticate
  // ============================================================
  describe('authenticate', () => {
    it('should return 401 when no authorization header is present', () => {
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is empty string', () => {
      req.headers.authorization = '';
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should extract Bearer token and call jwt.verify', () => {
      process.env.JWT_SECRET = 'test-secret';
      const mockUser = { id: 1, username: 'testuser', email: 'test@test.com' };
      jwt.verify.mockReturnValue(mockUser);

      req.headers.authorization = 'Bearer valid-jwt-token-here';
      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-jwt-token-here', 'test-secret');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });

    it('should handle token without Bearer prefix (raw token)', () => {
      process.env.JWT_SECRET = 'test-secret';
      const mockUser = { id: 2, username: 'rawuser' };
      jwt.verify.mockReturnValue(mockUser);

      req.headers.authorization = 'raw-token-no-bearer-prefix';
      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('raw-token-no-bearer-prefix', 'test-secret');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });

    it('should return 401 with "Token expired" for TokenExpiredError', () => {
      process.env.JWT_SECRET = 'test-secret';
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      req.headers.authorization = 'Bearer expired-token';
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
      expect(next).not.toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });

    it('should return 401 with "Invalid token" for other JWT errors', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      req.headers.authorization = 'Bearer invalid-token';
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });

    it('should return 401 with "Invalid token" for JsonWebTokenError', () => {
      process.env.JWT_SECRET = 'test-secret';
      const jwtError = new Error('invalid token');
      jwtError.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      req.headers.authorization = 'Bearer malformed-token';
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      delete process.env.JWT_SECRET;
    });

    it('should return 401 with "Invalid token" for NotBeforeError', () => {
      process.env.JWT_SECRET = 'test-secret';
      const nbfError = new Error('jwt not active');
      nbfError.name = 'NotBeforeError';
      jwt.verify.mockImplementation(() => {
        throw nbfError;
      });

      req.headers.authorization = 'Bearer not-yet-valid-token';
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      delete process.env.JWT_SECRET;
    });

    it('should attach decoded user to request object', () => {
      process.env.JWT_SECRET = 'test-secret';
      const decodedUser = {
        id: 42,
        username: 'johndoe',
        email: 'john@example.com',
        iat: 1234567890,
        exp: 1234567890,
      };
      jwt.verify.mockReturnValue(decodedUser);

      req.headers.authorization = 'Bearer valid-token';
      authenticate(req, res, next);

      expect(req.user).toBe(decodedUser);
      expect(req.user.id).toBe(42);
      expect(req.user.username).toBe('johndoe');
      expect(req.user.email).toBe('john@example.com');
      delete process.env.JWT_SECRET;
    });
  });

  // ============================================================
  // optionalAuth
  // ============================================================
  describe('optionalAuth', () => {
    it('should call next() when no authorization header is present', () => {
      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should call next() when authorization header is empty', () => {
      req.headers.authorization = '';
      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should attach user when valid Bearer token is provided', () => {
      process.env.JWT_SECRET = 'test-secret';
      const mockUser = { id: 5, username: 'optionaluser' };
      jwt.verify.mockReturnValue(mockUser);

      req.headers.authorization = 'Bearer valid-optional-token';
      optionalAuth(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-optional-token', 'test-secret');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });

    it('should call next() without user when token is invalid', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      req.headers.authorization = 'Bearer bad-token';
      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      delete process.env.JWT_SECRET;
    });

    it('should call next() without user when token is expired', () => {
      process.env.JWT_SECRET = 'test-secret';
      const expiredError = new Error('expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      req.headers.authorization = 'Bearer expired-token';
      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      delete process.env.JWT_SECRET;
    });

    it('should NOT return 401 for invalid tokens (unlike authenticate)', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.verify.mockImplementation(() => {
        throw new Error('bad signature');
      });

      req.headers.authorization = 'Bearer bad-signature';
      optionalAuth(req, res, next);

      // optionalAuth should never call res.status or res.json
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });

    it('should handle raw token (without Bearer prefix)', () => {
      process.env.JWT_SECRET = 'test-secret';
      const mockUser = { id: 10 };
      jwt.verify.mockReturnValue(mockUser);

      req.headers.authorization = 'raw-token-no-bearer';
      optionalAuth(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('raw-token-no-bearer', 'test-secret');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });
  });

  // ============================================================
  // generateToken
  // ============================================================
  describe('generateToken', () => {
    it('should call jwt.sign with correct user payload', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.sign.mockReturnValue('generated-jwt-token');

      const user = { id: 1, username: 'testuser', email: 'test@test.com' };
      const token = generateToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, username: 'testuser', email: 'test@test.com' },
        'test-secret',
        { expiresIn: '7d' }
      );
      expect(token).toBe('generated-jwt-token');
      delete process.env.JWT_SECRET;
    });

    it('should include only id, username, and email in payload', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.sign.mockReturnValue('token');

      const user = {
        id: 99,
        username: 'extrauser',
        email: 'extra@test.com',
        password: 'should-not-be-in-token',
        role: 'admin',
        extraField: 'should-not-appear',
      };
      generateToken(user);

      const callArgs = jwt.sign.mock.calls[0][0];
      expect(callArgs).toEqual({
        id: 99,
        username: 'extrauser',
        email: 'extra@test.com',
      });
      expect(callArgs.password).toBeUndefined();
      expect(callArgs.role).toBeUndefined();
      expect(callArgs.extraField).toBeUndefined();
      delete process.env.JWT_SECRET;
    });

    it('should set token expiry to 7 days', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.sign.mockReturnValue('token');

      generateToken({ id: 1, username: 'u', email: 'e@e.com' });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { expiresIn: '7d' }
      );
      delete process.env.JWT_SECRET;
    });

    it('should return the token string from jwt.sign', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.sign.mockReturnValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

      const result = generateToken({ id: 7, username: 'u7', email: 'u7@test.com' });

      expect(result).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
      expect(typeof result).toBe('string');
      delete process.env.JWT_SECRET;
    });
  });

  // ============================================================
  // Edge cases: Bearer prefix variations
  // ============================================================
  describe('Bearer token extraction edge cases', () => {
    it('should correctly strip "Bearer " prefix with single space', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.verify.mockReturnValue({ id: 1 });

      req.headers.authorization = 'Bearer mytoken123';
      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('mytoken123', 'test-secret');
      delete process.env.JWT_SECRET;
    });

    it('should handle Bearer with extra spaces by NOT stripping them', () => {
      // substring(7) removes exactly 7 chars: 'Bearer '
      process.env.JWT_SECRET = 'test-secret';
      jwt.verify.mockReturnValue({ id: 1 });

      req.headers.authorization = 'Bearer  double-space-token';
      authenticate(req, res, next);

      // substring(7) gives ' double-space-token' (with leading space)
      expect(jwt.verify).toHaveBeenCalledWith(' double-space-token', 'test-secret');
      delete process.env.JWT_SECRET;
    });

    it('should treat "bearer" (lowercase) as raw token', () => {
      process.env.JWT_SECRET = 'test-secret';
      jwt.verify.mockReturnValue({ id: 1 });

      req.headers.authorization = 'bearer lowercase-token';
      authenticate(req, res, next);

      // 'bearer ' does not start with 'Bearer ', so entire string is treated as token
      expect(jwt.verify).toHaveBeenCalledWith('bearer lowercase-token', 'test-secret');
      delete process.env.JWT_SECRET;
    });
  });
});
