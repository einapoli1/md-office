import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '../lib/i18n';

const STORAGE_KEY = 'md-office-a11y';

interface A11ySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: number;
  screenReaderAnnouncements: boolean;
}

const defaults: A11ySettings = {
  highContrast: false,
  reducedMotion: false,
  fontSize: 14,
  screenReaderAnnouncements: true,
};

function loadSettings(): A11ySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return defaults;
}

function applySettings(s: A11ySettings) {
  const root = document.documentElement;
  root.classList.toggle('high-contrast', s.highContrast);
  root.classList.toggle('reduced-motion', s.reducedMotion);
  root.style.setProperty('--ui-font-size', `${s.fontSize}px`);
}

// Apply on load
applySettings(loadSettings());

interface AccessibilitySettingsProps {
  open: boolean;
  onClose: () => void;
}

const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<A11ySettings>(loadSettings);
  const dialogRef = useRef<HTMLDivElement>(null);

  const save = useCallback((s: A11ySettings) => {
    setSettings(s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    applySettings(s);
  }, []);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>('button, input, select, [tabindex]');
    if (focusable.length) focusable[0].focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (key: keyof A11ySettings) => {
    save({ ...settings, [key]: !settings[key] });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('accessibility.title')}
        style={{
          background: 'var(--bg-primary, #fff)', borderRadius: 8,
          padding: 24, minWidth: 360, maxWidth: 480,
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          color: 'var(--text-primary, #000)',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('accessibility.title')}</h2>

        <SettingRow
          label={t('accessibility.highContrast')}
          desc={t('accessibility.highContrastDesc')}
          checked={settings.highContrast}
          onChange={() => toggle('highContrast')}
        />
        <SettingRow
          label={t('accessibility.reducedMotion')}
          desc={t('accessibility.reducedMotionDesc')}
          checked={settings.reducedMotion}
          onChange={() => toggle('reducedMotion')}
        />
        <SettingRow
          label={t('accessibility.screenReaderAnnouncements')}
          desc={t('accessibility.screenReaderDesc')}
          checked={settings.screenReaderAnnouncements}
          onChange={() => toggle('screenReaderAnnouncements')}
        />

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>
            {t('accessibility.fontSize')}
          </label>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>{t('accessibility.fontSizeDesc')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={10}
              max={24}
              value={settings.fontSize}
              onChange={e => save({ ...settings, fontSize: Number(e.target.value) })}
              aria-label={t('accessibility.fontSize')}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 13, minWidth: 36 }}>{settings.fontSize}px</span>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 4,
              background: 'var(--accent-color, #1a73e8)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 14,
            }}
          >
            {t('accessibility.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

function SettingRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ flex: 1 }}>
        <label style={{ fontWeight: 500, cursor: 'pointer' }} onClick={onChange}>{label}</label>
        <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0' }}>{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--accent-color, #1a73e8)' : '#ccc',
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0, marginLeft: 12,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

export default AccessibilitySettings;
