import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface Preferences {
  // General
  defaultFormat: 'md' | 'txt' | 'html';
  autoSaveInterval: number; // seconds, 0 = off
  spellCheckLanguage: string;
  showWordCount: boolean;

  // Editor
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  showInvisibles: boolean;
  showRuler: boolean;
  defaultZoom: number;
  cursorStyle: 'block' | 'line' | 'underline';

  // Theme
  themeMode: 'light' | 'dark' | 'system';
  accentColor: string;
  customCSS: string;

  // Collaboration
  displayName: string;
  cursorColor: string;
  showOtherCursors: boolean;
  notificationSounds: boolean;

  // Keyboard (custom keybindings stored separately)
  customKeybindings: Record<string, string>;
}

export const ACCENT_PRESETS = [
  '#1a73e8', // Google Blue
  '#e8710a', // Orange
  '#0d904f', // Green
  '#9334e6', // Purple
  '#e6334a', // Red
  '#00838f', // Teal
];

export const defaultPreferences: Preferences = {
  defaultFormat: 'md',
  autoSaveInterval: 1,
  spellCheckLanguage: 'en-US',
  showWordCount: true,

  fontFamily: 'system-ui, sans-serif',
  fontSize: 16,
  lineHeight: 1.6,
  showInvisibles: false,
  showRuler: true,
  defaultZoom: 100,
  cursorStyle: 'line',

  themeMode: 'system',
  accentColor: '#1a73e8',
  customCSS: '',

  displayName: 'You',
  cursorColor: '#1a73e8',
  showOtherCursors: true,
  notificationSounds: true,

  customKeybindings: {},
};

const STORAGE_KEY = 'md-office-preferences';

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaultPreferences };
}

function savePreferences(prefs: Preferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function exportPreferences(prefs: Preferences): string {
  return JSON.stringify(prefs, null, 2);
}

export function importPreferences(json: string): Preferences | null {
  try {
    const parsed = JSON.parse(json);
    return { ...defaultPreferences, ...parsed };
  } catch {
    return null;
  }
}

interface PreferencesContextValue {
  prefs: Preferences;
  update: (partial: Partial<Preferences>) => void;
  reset: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: defaultPreferences,
  update: () => {},
  reset: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  const update = useCallback((partial: Partial<Preferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...partial };
      savePreferences(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs({ ...defaultPreferences });
    savePreferences(defaultPreferences);
  }, []);

  // Apply CSS variables whenever prefs change
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pref-font-family', prefs.fontFamily);
    root.style.setProperty('--pref-font-size', `${prefs.fontSize}px`);
    root.style.setProperty('--pref-line-height', String(prefs.lineHeight));
    root.style.setProperty('--pref-accent-color', prefs.accentColor);
    root.style.setProperty('--pref-zoom', `${prefs.defaultZoom}%`);

    // Theme mode
    if (prefs.themeMode === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.toggle('dark', dark);
    } else {
      document.body.classList.toggle('dark', prefs.themeMode === 'dark');
    }

    // Custom CSS
    let styleEl = document.getElementById('pref-custom-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'pref-custom-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = prefs.customCSS;
  }, [prefs]);

  return React.createElement(PreferencesContext.Provider, { value: { prefs, update, reset } }, children);
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
