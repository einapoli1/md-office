import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from './locales/en';
import type { TranslationKeys } from './locales/en';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';

const STORAGE_KEY = 'md-office-language';

const loaders: Record<SupportedLanguage, () => Promise<{ default: TranslationKeys }>> = {
  en: () => Promise.resolve({ default: en }),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  ja: () => import('./locales/ja'),
  zh: () => import('./locales/zh'),
};

export const LANGUAGES: Record<SupportedLanguage, { flag: string; name: string }> = {
  en: { flag: '🇺🇸', name: 'English' },
  es: { flag: '🇪🇸', name: 'Español' },
  fr: { flag: '🇫🇷', name: 'Français' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  ja: { flag: '🇯🇵', name: '日本語' },
  zh: { flag: '🇨🇳', name: '中文' },
};

function detectLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in LANGUAGES) return stored as SupportedLanguage;
  const nav = navigator.language.split('-')[0];
  if (nav in LANGUAGES) return nav as SupportedLanguage;
  return 'en';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, path: string): string {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return path;
    current = current[part];
  }
  return typeof current === 'string' ? current : path;
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

function createT(translations: TranslationKeys): TFunction {
  return (key: string, params?: Record<string, string | number>) => {
    let value = getNestedValue(translations, key);
    if (value === key) {
      // Fallback to English
      value = getNestedValue(en, key);
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  };
}

interface I18nContextValue {
  t: TFunction;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const I18nContext = createContext<I18nContextValue>({
  t: createT(en),
  language: 'en',
  setLanguage: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(detectLanguage);
  const [translations, setTranslations] = useState<TranslationKeys>(en);

  const loadTranslations = useCallback(async (lang: SupportedLanguage) => {
    const mod = await loaders[lang]();
    setTranslations(mod.default);
  }, []);

  useEffect(() => {
    loadTranslations(language);
  }, [language, loadTranslations]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    localStorage.setItem(STORAGE_KEY, lang);
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => createT(translations)(key, params),
    [translations]
  );

  return React.createElement(
    I18nContext.Provider,
    { value: { t, language, setLanguage } },
    children
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
