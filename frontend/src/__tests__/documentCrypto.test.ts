import { describe, it, expect, beforeAll } from 'vitest';
import { encryptDocument, decryptDocument, hashPassword, getPasswordStrength } from '../lib/documentCrypto';
import { webcrypto } from 'node:crypto';

beforeAll(() => {
  // jsdom's crypto.subtle doesn't support PBKDF2; use Node's webcrypto
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
});

describe('documentCrypto', () => {
  describe('encryptDocument / decryptDocument', () => {
    it('should encrypt and decrypt content correctly', async () => {
      const content = 'Hello, secret world!';
      const password = 'myP@ssw0rd';
      const encrypted = await encryptDocument(content, password);
      expect(encrypted).not.toBe(content);
      expect(typeof encrypted).toBe('string');

      const decrypted = await decryptDocument(encrypted, password);
      expect(decrypted).toBe(content);
    });

    it('should fail decryption with wrong password', async () => {
      const encrypted = await encryptDocument('secret', 'correct');
      await expect(decryptDocument(encrypted, 'wrong')).rejects.toThrow('Incorrect password');
    });

    it('should produce different ciphertext each time (random salt/iv)', async () => {
      const content = 'same content';
      const password = 'pass';
      const a = await encryptDocument(content, password);
      const b = await encryptDocument(content, password);
      expect(a).not.toBe(b);
    });

    it('should handle empty content', async () => {
      const encrypted = await encryptDocument('', 'pass');
      const decrypted = await decryptDocument(encrypted, 'pass');
      expect(decrypted).toBe('');
    });

    it('should handle unicode content', async () => {
      const content = '日本語テスト 🎉 émojis';
      const encrypted = await encryptDocument(content, 'pass');
      const decrypted = await decryptDocument(encrypted, 'pass');
      expect(decrypted).toBe(content);
    });
  });

  describe('hashPassword', () => {
    it('should produce deterministic hashes', async () => {
      const h1 = await hashPassword('test');
      const h2 = await hashPassword('test');
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different passwords', async () => {
      const h1 = await hashPassword('password1');
      const h2 = await hashPassword('password2');
      expect(h1).not.toBe(h2);
    });
  });

  describe('getPasswordStrength', () => {
    it('should rate short passwords as weak', () => {
      expect(getPasswordStrength('abc')).toBe('weak');
    });

    it('should rate medium-complexity passwords as medium', () => {
      expect(getPasswordStrength('Abcdefgh1')).toBe('medium');
    });

    it('should rate complex passwords as strong', () => {
      expect(getPasswordStrength('MyP@ssw0rd!23')).toBe('strong');
    });
  });
});
