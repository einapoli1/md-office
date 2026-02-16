/**
 * Document encryption/decryption utilities using Web Crypto API.
 * AES-256-GCM with PBKDF2 key derivation.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API not available');
}

function getRandomValues(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Cast Uint8Array to BufferSource for Web Crypto API compatibility.
// We use `as any` because TypeScript's strict types conflict with
// the runtime reality that Uint8Array is a valid BufferSource.
function asBuffer(arr: Uint8Array): BufferSource {
  return arr as unknown as BufferSource;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: asBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt document content with a password.
 * Returns base64-encoded string: salt (16) + iv (12) + ciphertext.
 */
export async function encryptDocument(content: string, password: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const salt = getRandomValues(SALT_LENGTH);
  const iv = getRandomValues(IV_LENGTH);
  const key = await deriveKey(password, salt);

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: asBuffer(iv) },
    key,
    encoder.encode(content)
  );

  // Concatenate salt + iv + ciphertext
  const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_LENGTH);
  result.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  return toBase64(result);
}

/**
 * Decrypt document content with a password.
 * Input is base64-encoded salt + iv + ciphertext.
 */
export async function decryptDocument(encrypted: string, password: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const data = fromBase64(encrypted);

  if (data.length < SALT_LENGTH + IV_LENGTH + 1) {
    throw new Error('Invalid encrypted data');
  }

  const salt = data.slice(0, SALT_LENGTH);
  const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = data.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  try {
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: asBuffer(iv) },
      key,
      asBuffer(ciphertext)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('Incorrect password or corrupted data');
  }
}

/**
 * Hash a password for quick verification.
 * Uses PBKDF2 with a fixed salt derived from the password itself.
 */
export async function hashPassword(password: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  // Double SHA-256 with a fixed prefix for quick password verification
  const first = await subtle.digest('SHA-256', encoder.encode('mdoffice:' + password));
  const second = await subtle.digest('SHA-256', first);
  return toBase64(second);
}

/**
 * Evaluate password strength.
 */
export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}
