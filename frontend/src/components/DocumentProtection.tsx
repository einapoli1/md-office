import React, { useState } from 'react';
import { X, Lock, Unlock, Shield } from 'lucide-react';

export type ProtectionLevel = 'none' | 'readonly' | 'comments' | 'formfill' | 'full';

export interface ProtectionSettings {
  level: ProtectionLevel;
  encrypted: boolean;
  iv?: string; // base64
  salt?: string; // base64
}

interface DocumentProtectionProps {
  currentLevel: ProtectionLevel;
  isEncrypted: boolean;
  onClose: () => void;
  onApply: (level: ProtectionLevel, password: string | null) => void;
}

const LEVELS: { value: ProtectionLevel; label: string; desc: string }[] = [
  { value: 'none', label: 'No Protection', desc: 'Anyone can edit freely' },
  { value: 'comments', label: 'Read-only (allow comments)', desc: 'Viewers can add comments but not edit' },
  { value: 'formfill', label: 'Form fill only', desc: 'Only form fields can be edited' },
  { value: 'full', label: 'Full lock', desc: 'No editing, no comments — view only' },
];

// Crypto helpers using Web Crypto API (AES-GCM)
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptContent(content: string, password: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(content));
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

export async function decryptContent(ciphertext: string, password: string, ivB64: string, saltB64: string): Promise<string> {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const key = await deriveKey(password, salt);
  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

const DocumentProtection: React.FC<DocumentProtectionProps> = ({ currentLevel, isEncrypted, onClose, onApply }) => {
  const [level, setLevel] = useState<ProtectionLevel>(currentLevel);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usePassword, setUsePassword] = useState(isEncrypted);
  const [error, setError] = useState('');

  const handleApply = () => {
    if (usePassword && level !== 'none') {
      if (!password) { setError('Password is required'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
      if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
    }
    setError('');
    onApply(level, usePassword && level !== 'none' ? password : null);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--bg, #fff)', borderRadius: 8, width: 460, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} /> Protect Document
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {isEncrypted && (
          <div style={{ padding: '8px 12px', background: '#fff3cd', borderRadius: 4, marginBottom: 16, fontSize: 13, color: '#856404' }}>
            This document is currently encrypted and protected.
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'block' }}>Protection Level</label>
          {LEVELS.map(l => (
            <label key={l.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>
              <input type="radio" name="protection" checked={level === l.value} onChange={() => setLevel(l.value)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {l.value === 'none' ? <Unlock size={14} /> : <Lock size={14} />}
                  {l.label}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>{l.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {level !== 'none' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={usePassword} onChange={e => setUsePassword(e.target.checked)} />
              Password protect (AES-256 encryption)
            </label>
            {usePassword && (
              <div style={{ display: 'grid', gap: 8 }}>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </div>
            )}
          </div>
        )}

        {error && <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleApply} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: level === 'none' ? '#34a853' : '#1a73e8', color: '#fff', cursor: 'pointer' }}>
            {level === 'none' ? 'Remove Protection' : 'Apply Protection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentProtection;
