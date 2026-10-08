import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken, JWTPayload } from './jwt';

describe('JWT utilities', () => {
  const payload: JWTPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT string', () => {
      const token = generateToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = generateToken(payload);
      const token2 = generateToken({ ...payload, userId: 'user-456' });
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(payload.userId);
      expect(decoded!.email).toBe(payload.email);
      expect(decoded!.name).toBe(payload.name);
    });

    it('should return null for an invalid token', () => {
      const result = verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for a tampered token', () => {
      const token = generateToken(payload);
      const tampered = token.slice(0, -5) + 'xxxxx';
      const result = verifyToken(tampered);
      expect(result).toBeNull();
    });

    it('should return null for an empty string', () => {
      const result = verifyToken('');
      expect(result).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should preserve all payload fields through generate→verify', () => {
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).toMatchObject(payload);
    });
  });
});
