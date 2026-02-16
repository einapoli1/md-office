import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Lock, Unlock, ShieldCheck, ShieldX } from 'lucide-react';
import { getPasswordStrength } from '../lib/documentCrypto';

export type PasswordDialogMode = 'set' | 'unlock' | 'change' | 'remove';

interface PasswordDialogProps {
  mode: PasswordDialogMode;
  onSubmit: (data: PasswordDialogResult) => void;
  onCancel: () => void;
  error?: string;
  passwordHint?: string;
}

export interface PasswordDialogResult {
  password: string;
  newPassword?: string;
  hint?: string;
}

const strengthColors = { weak: '#d32f2f', medium: '#f9a825', strong: '#388e3c' };
const strengthLabels = { weak: 'Weak', medium: 'Medium', strong: 'Strong' };

const PasswordDialog: React.FC<PasswordDialogProps> = ({ mode, onSubmit, onCancel, error, passwordHint }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const strength = mode === 'set' ? getPasswordStrength(password) : mode === 'change' ? getPasswordStrength(newPassword) : null;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (mode === 'set') {
      if (password !== confirmPassword) { setLocalError('Passwords do not match'); return; }
      if (!password) { setLocalError('Password is required'); return; }
      onSubmit({ password, hint: hint || undefined });
    } else if (mode === 'unlock' || mode === 'remove') {
      if (!password) { setLocalError('Password is required'); return; }
      onSubmit({ password });
    } else if (mode === 'change') {
      if (!password) { setLocalError('Current password is required'); return; }
      if (newPassword !== confirmNew) { setLocalError('New passwords do not match'); return; }
      if (!newPassword) { setLocalError('New password is required'); return; }
      onSubmit({ password, newPassword, hint: hint || undefined });
    }
  }, [mode, password, confirmPassword, newPassword, confirmNew, hint, onSubmit]);

  const titles: Record<PasswordDialogMode, string> = {
    set: 'Set Password',
    unlock: 'Unlock Document',
    change: 'Change Password',
    remove: 'Remove Password',
  };

  const icons: Record<PasswordDialogMode, React.ReactNode> = {
    set: <ShieldCheck size={20} />,
    unlock: <Unlock size={20} />,
    change: <Lock size={20} />,
    remove: <ShieldX size={20} />,
  };

  const displayError = error || localError;
  const inputType = showPassword ? 'text' : 'password';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 10000,
    }} onClick={onCancel}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: 'white', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {icons[mode]}
          <h3 style={{ margin: 0, fontSize: 18 }}>{titles[mode]}</h3>
        </div>

        {mode === 'unlock' && passwordHint && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12, background: '#f5f5f5', padding: '6px 10px', borderRadius: 6 }}>
            💡 Hint: {passwordHint}
          </div>
        )}

        {/* Current / main password field */}
        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#555' }}>
          {mode === 'change' ? 'Current Password' : 'Password'}
        </label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={inputType}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{
              width: '100%', padding: '8px 36px 8px 10px', border: '1px solid #ccc',
              borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
            }}
            placeholder={mode === 'unlock' ? 'Enter password to unlock' : 'Enter password'}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888' }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Confirm for set mode */}
        {mode === 'set' && (
          <>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#555' }}>Confirm Password</label>
            <input
              type={inputType}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              placeholder="Confirm password"
            />
          </>
        )}

        {/* New password fields for change mode */}
        {mode === 'change' && (
          <>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#555' }}>New Password</label>
            <input
              type={inputType}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              placeholder="Enter new password"
            />
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#555' }}>Confirm New Password</label>
            <input
              type={inputType}
              value={confirmNew}
              onChange={e => setConfirmNew(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              placeholder="Confirm new password"
            />
          </>
        )}

        {/* Strength indicator */}
        {strength && (mode === 'set' || mode === 'change') && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {(['weak', 'medium', 'strong'] as const).map(level => (
                <div
                  key={level}
                  style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: (['weak', 'medium', 'strong'].indexOf(level) <= ['weak', 'medium', 'strong'].indexOf(strength))
                      ? strengthColors[strength] : '#e0e0e0',
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 12, color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
          </div>
        )}

        {/* Hint field for set/change */}
        {(mode === 'set' || mode === 'change') && (
          <>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#555' }}>Password Hint (optional)</label>
            <input
              type="text"
              value={hint}
              onChange={e => setHint(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              placeholder="A hint to remember your password"
            />
          </>
        )}

        {displayError && (
          <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12 }}>{displayError}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: 'white',
              background: mode === 'remove' ? '#d32f2f' : '#1a73e8',
            }}
          >
            {mode === 'set' ? 'Protect' : mode === 'unlock' ? 'Unlock' : mode === 'change' ? 'Change' : 'Remove Protection'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordDialog;
