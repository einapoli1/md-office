import React, { useState, useRef, useEffect } from 'react';
import { useI18n, LANGUAGES, type SupportedLanguage } from '../lib/i18n';

const LanguagePicker: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = LANGUAGES[language];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={t('menu.tools.language')}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 8px', borderRadius: 4, fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4,
          color: 'inherit',
        }}
      >
        <span>{current.flag}</span>
        <span>{current.name}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('language.title')}
          style={{
            position: 'absolute', bottom: '100%', right: 0,
            background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-color, #ddd)',
            borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            listStyle: 'none', margin: 0, padding: 4, minWidth: 150, zIndex: 10000,
          }}
        >
          {(Object.entries(LANGUAGES) as [SupportedLanguage, { flag: string; name: string }][]).map(([code, { flag, name }]) => (
            <li
              key={code}
              role="option"
              aria-selected={code === language}
              onClick={() => { setLanguage(code); setOpen(false); }}
              style={{
                padding: '6px 12px', cursor: 'pointer', borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 8,
                background: code === language ? 'var(--accent-bg, #e8f0fe)' : 'transparent',
                fontSize: 13,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg, #f0f0f0)')}
              onMouseLeave={e => (e.currentTarget.style.background = code === language ? 'var(--accent-bg, #e8f0fe)' : 'transparent')}
            >
              <span>{flag}</span>
              <span>{name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguagePicker;
