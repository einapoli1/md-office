/**
 * Digital Signature Engine
 * RSA-2048 key pairs via Web Crypto API, SHA-256 document hashing,
 * signature verification, and YAML frontmatter storage.
 */

// --- Helpers ---

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API not available');
}

export function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Types ---

export interface SigningIdentity {
  name: string;
  email: string;
  organization: string;
  publicKeyJWK: JsonWebKey;
  privateKeyJWK: JsonWebKey;
  fingerprint: string;
  createdAt: string;
  signatureImage?: string; // data URL of drawn/typed signature
}

export interface DocumentSignature {
  signerName: string;
  signerEmail: string;
  signerOrg: string;
  date: string;
  publicKeyFingerprint: string;
  publicKeyJWK: JsonWebKey;
  signature: string; // base64
  contentHash: string; // base64 SHA-256 of content at signing time
}

export type SignatureStatus = 'valid' | 'invalid' | 'unverified';

export interface VerifiedSignature extends DocumentSignature {
  status: SignatureStatus;
}

// --- Key Generation & Management ---

const RSA_ALGORITHM: RsaHashedKeyGenParams = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  const subtle = getSubtleCrypto();
  return subtle.generateKey(RSA_ALGORITHM, true, ['sign', 'verify']);
}

export async function exportKeyAsJWK(key: CryptoKey): Promise<JsonWebKey> {
  const subtle = getSubtleCrypto();
  return subtle.exportKey('jwk', key);
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']);
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['sign']);
}

export async function computeFingerprint(publicKeyJWK: JsonWebKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoded = new TextEncoder().encode(JSON.stringify(publicKeyJWK));
  const hash = await subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(hash);
  // Return first 16 hex chars as fingerprint
  return Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(':');
}

// --- Signing & Verification ---

export async function hashContent(content: string): Promise<ArrayBuffer> {
  const subtle = getSubtleCrypto();
  const encoded = new TextEncoder().encode(content);
  return subtle.digest('SHA-256', encoded);
}

export async function signContent(content: string, privateKeyJWK: JsonWebKey): Promise<{ signature: string; contentHash: string }> {
  const subtle = getSubtleCrypto();
  const privateKey = await importPrivateKey(privateKeyJWK);
  const hash = await hashContent(content);
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', privateKey, hash);
  return {
    signature: toBase64(sig),
    contentHash: toBase64(hash),
  };
}

export async function verifySignature(
  content: string,
  signatureBase64: string,
  publicKeyJWK: JsonWebKey,
  originalContentHash: string
): Promise<SignatureStatus> {
  try {
    const subtle = getSubtleCrypto();
    // Check if content has changed
    const currentHash = await hashContent(content);
    const currentHashB64 = toBase64(currentHash);
    if (currentHashB64 !== originalContentHash) {
      return 'invalid'; // content changed since signing
    }
    const publicKey = await importPublicKey(publicKeyJWK);
    const sigBytes = fromBase64(signatureBase64);
    const valid = await subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sigBytes.buffer as ArrayBuffer, currentHash);
    return valid ? 'valid' : 'invalid';
  } catch {
    return 'unverified';
  }
}

// --- Signing Identity Management (localStorage) ---

const IDENTITY_STORAGE_KEY = 'md-office-signing-identities';
const ACTIVE_IDENTITY_KEY = 'md-office-active-identity';

export function getStoredIdentities(): SigningIdentity[] {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function storeIdentity(identity: SigningIdentity): void {
  const identities = getStoredIdentities();
  const idx = identities.findIndex(i => i.fingerprint === identity.fingerprint);
  if (idx >= 0) {
    identities[idx] = identity;
  } else {
    identities.push(identity);
  }
  localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identities));
}

export function getActiveIdentity(): SigningIdentity | null {
  try {
    const fp = localStorage.getItem(ACTIVE_IDENTITY_KEY);
    if (!fp) return getStoredIdentities()[0] || null;
    return getStoredIdentities().find(i => i.fingerprint === fp) || null;
  } catch {
    return null;
  }
}

export function setActiveIdentity(fingerprint: string): void {
  localStorage.setItem(ACTIVE_IDENTITY_KEY, fingerprint);
}

export async function createSigningIdentity(
  name: string,
  email: string,
  organization: string
): Promise<SigningIdentity> {
  const keyPair = await generateKeyPair();
  const publicKeyJWK = await exportKeyAsJWK(keyPair.publicKey);
  const privateKeyJWK = await exportKeyAsJWK(keyPair.privateKey);
  const fingerprint = await computeFingerprint(publicKeyJWK);
  const identity: SigningIdentity = {
    name,
    email,
    organization,
    publicKeyJWK,
    privateKeyJWK,
    fingerprint,
    createdAt: new Date().toISOString(),
  };
  storeIdentity(identity);
  setActiveIdentity(fingerprint);
  return identity;
}

// --- Document Signature Operations ---

export async function signDocument(
  content: string,
  identity: SigningIdentity
): Promise<DocumentSignature> {
  const { signature, contentHash } = await signContent(content, identity.privateKeyJWK);
  return {
    signerName: identity.name,
    signerEmail: identity.email,
    signerOrg: identity.organization,
    date: new Date().toISOString(),
    publicKeyFingerprint: identity.fingerprint,
    publicKeyJWK: identity.publicKeyJWK,
    signature,
    contentHash,
  };
}

export async function verifyDocumentSignatures(
  content: string,
  signatures: DocumentSignature[]
): Promise<VerifiedSignature[]> {
  return Promise.all(
    signatures.map(async (sig) => {
      const status = await verifySignature(content, sig.signature, sig.publicKeyJWK, sig.contentHash);
      return { ...sig, status };
    })
  );
}

// --- Frontmatter Integration ---

export function parseSignaturesFromFrontmatter(metadata: Record<string, any>): DocumentSignature[] {
  if (!metadata.signatures || !Array.isArray(metadata.signatures)) return [];
  return metadata.signatures.map((s: any) => ({
    signerName: s.signerName || '',
    signerEmail: s.signerEmail || '',
    signerOrg: s.signerOrg || '',
    date: s.date || '',
    publicKeyFingerprint: s.publicKeyFingerprint || '',
    publicKeyJWK: typeof s.publicKeyJWK === 'string' ? JSON.parse(s.publicKeyJWK) : (s.publicKeyJWK || {}),
    signature: s.signature || '',
    contentHash: s.contentHash || '',
  }));
}

export function signaturesToFrontmatter(signatures: DocumentSignature[]): Record<string, any>[] {
  return signatures.map(s => ({
    signerName: s.signerName,
    signerEmail: s.signerEmail,
    signerOrg: s.signerOrg,
    date: s.date,
    publicKeyFingerprint: s.publicKeyFingerprint,
    publicKeyJWK: JSON.stringify(s.publicKeyJWK),
    signature: s.signature,
    contentHash: s.contentHash,
  }));
}
