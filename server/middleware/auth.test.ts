import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateJWT, optionalAuth, AuthRequest } from './auth';
import { generateToken } from '../auth/jwt';
import { Response, NextFunction } from 'express';

function createMockReqResNext(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
  } as AuthRequest;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('authenticateJWT', () => {
  const validPayload = { userId: 'user-1', email: 'a@b.com', name: 'A' };

  it('should call next and set req.user for a valid token', () => {
    const token = generateToken(validPayload);
    const { req, res, next } = createMockReqResNext(`Bearer ${token}`);

    authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-1');
    expect(req.user!.email).toBe('a@b.com');
  });

  it('should return 401 when no Authorization header is present', () => {
    const { req, res, next } = createMockReqResNext();

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header has no token', () => {
    const { req, res, next } = createMockReqResNext('Bearer ');

    authenticateJWT(req, res, next);

    // 'Bearer '.split(' ')[1] === '' which is falsy
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid or expired token', () => {
    const { req, res, next } = createMockReqResNext('Bearer invalid-token');

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  const validPayload = { userId: 'user-1', email: 'a@b.com', name: 'A' };

  it('should set req.user and call next for a valid token', () => {
    const token = generateToken(validPayload);
    const { req, res, next } = createMockReqResNext(`Bearer ${token}`);

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-1');
  });

  it('should call next without setting user when no token is present', () => {
    const { req, res, next } = createMockReqResNext();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('should call next without setting user for an invalid token', () => {
    const { req, res, next } = createMockReqResNext('Bearer bad-token');

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
