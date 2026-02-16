import { describe, it, expect } from 'vitest';
import {
  generateKeyPair, exportKeyAsJWK, importPublicKey, importPrivateKey,
  computeFingerprint, signContent, verifySignature,
  signDocument, verifyDocumentSignatures,
  toBase64, fromBase64,
  parseSignaturesFromFrontmatter, signaturesToFrontmatter,
  type SigningIdentity, type DocumentSignature,
} from '../lib/digitalSignature';

describe('digitalSignature', () => {
  describe('base64 helpers', () => {
    it('round-trips binary data', () => {
      const data = new Uint8Array([0, 1, 255, 128, 64]);
      const b64 = toBase64(data);
      const back = fromBase64(b64);
      expect(Array.from(back)).toEqual(Array.from(data));
    });
  });

  describe('key generation', () => {
    it('generates an RSA-2048 key pair', async () => {
      const kp = await generateKeyPair();
      expect(kp.publicKey).toBeDefined();
      expect(kp.privateKey).toBeDefined();
    });

    it('exports and imports keys as JWK', async () => {
      const kp = await generateKeyPair();
      const pubJWK = await exportKeyAsJWK(kp.publicKey);
      const privJWK = await exportKeyAsJWK(kp.privateKey);
      expect(pubJWK.kty).toBe('RSA');
      expect(privJWK.kty).toBe('RSA');

      const reimportedPub = await importPublicKey(pubJWK);
      expect(reimportedPub.type).toBe('public');
      const reimportedPriv = await importPrivateKey(privJWK);
      expect(reimportedPriv.type).toBe('private');
    });
  });

  describe('fingerprint', () => {
    it('produces a deterministic fingerprint', async () => {
      const kp = await generateKeyPair();
      const pubJWK = await exportKeyAsJWK(kp.publicKey);
      const fp1 = await computeFingerprint(pubJWK);
      const fp2 = await computeFingerprint(pubJWK);
      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);
    });
  });

  describe('signing and verification', () => {
    it('signs and verifies content', async () => {
      const kp = await generateKeyPair();
      const pubJWK = await exportKeyAsJWK(kp.publicKey);
      const privJWK = await exportKeyAsJWK(kp.privateKey);
      const content = 'Hello, World!';

      const { signature, contentHash } = await signContent(content, privJWK);
      expect(signature).toBeTruthy();
      expect(contentHash).toBeTruthy();

      const status = await verifySignature(content, signature, pubJWK, contentHash);
      expect(status).toBe('valid');
    });

    it('returns invalid when content changes', async () => {
      const kp = await generateKeyPair();
      const pubJWK = await exportKeyAsJWK(kp.publicKey);
      const privJWK = await exportKeyAsJWK(kp.privateKey);

      const { signature, contentHash } = await signContent('original', privJWK);
      const status = await verifySignature('modified', signature, pubJWK, contentHash);
      expect(status).toBe('invalid');
    });
  });

  describe('document signing', () => {
    it('signs a document and verifies', async () => {
      const kp = await generateKeyPair();
      const pubJWK = await exportKeyAsJWK(kp.publicKey);
      const privJWK = await exportKeyAsJWK(kp.privateKey);
      const fp = await computeFingerprint(pubJWK);

      const identity: SigningIdentity = {
        name: 'Test User',
        email: 'test@example.com',
        organization: 'Test Org',
        publicKeyJWK: pubJWK,
        privateKeyJWK: privJWK,
        fingerprint: fp,
        createdAt: new Date().toISOString(),
      };

      const content = 'Document content here';
      const sig = await signDocument(content, identity);
      expect(sig.signerName).toBe('Test User');
      expect(sig.signature).toBeTruthy();

      const verified = await verifyDocumentSignatures(content, [sig]);
      expect(verified).toHaveLength(1);
      expect(verified[0].status).toBe('valid');
    });
  });

  describe('frontmatter integration', () => {
    it('round-trips signatures through frontmatter format', async () => {
      const kp = await generateKeyPair();
      const pubJWK = await exportKeyAsJWK(kp.publicKey);

      const sig: DocumentSignature = {
        signerName: 'Alice',
        signerEmail: 'alice@example.com',
        signerOrg: 'ACME',
        date: '2025-01-01T00:00:00.000Z',
        publicKeyFingerprint: 'aa:bb:cc:dd:ee:ff:00:11',
        publicKeyJWK: pubJWK,
        signature: 'dGVzdA==',
        contentHash: 'aGFzaA==',
      };

      const fm = signaturesToFrontmatter([sig]);
      expect(fm).toHaveLength(1);
      expect(fm[0].signerName).toBe('Alice');
      // publicKeyJWK should be stringified
      expect(typeof fm[0].publicKeyJWK).toBe('string');

      const parsed = parseSignaturesFromFrontmatter({ signatures: fm });
      expect(parsed).toHaveLength(1);
      expect(parsed[0].signerName).toBe('Alice');
      expect(parsed[0].publicKeyJWK.kty).toBe('RSA');
    });

    it('handles missing signatures gracefully', () => {
      expect(parseSignaturesFromFrontmatter({})).toEqual([]);
      expect(parseSignaturesFromFrontmatter({ signatures: 'not-an-array' })).toEqual([]);
    });
  });
});
