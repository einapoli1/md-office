import { describe, it, expect } from 'vitest';
import { generateSessionCode } from '../AudienceQA';

describe('AudienceQA helpers', () => {
  describe('generateSessionCode', () => {
    it('generates a 6-character code', () => {
      const code = generateSessionCode();
      expect(code).toHaveLength(6);
    });

    it('only uses alphanumeric characters', () => {
      for (let i = 0; i < 20; i++) {
        const code = generateSessionCode();
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      }
    });

    it('generates unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        codes.add(generateSessionCode());
      }
      // With 6 chars from 32-char alphabet, collisions extremely unlikely in 50 tries
      expect(codes.size).toBeGreaterThan(45);
    });

    it('excludes ambiguous characters', () => {
      // Generate many codes and check none contain O, 0, I, 1, l
      for (let i = 0; i < 100; i++) {
        const code = generateSessionCode();
        expect(code).not.toMatch(/[OIl01]/);
      }
    });
  });
});
