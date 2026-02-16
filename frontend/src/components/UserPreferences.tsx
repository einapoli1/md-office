import { useState, useEffect } from 'react';
import { X, Download, Upload } from 'lucide-react';
import { usePreferences, exportPreferences, importPreferences, ACCENT_PRESETS } from '../lib/preferencesStore';
import ThemeCustomizer from './ThemeCustomizer';

type Tab = 'general' | 'editor' | 'theme' | 'collaboration' | 'keyboard';

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'editor', label: 'Editor' },
  { key: 'theme', label: 'Theme' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'keyboard', label: 'Keyboard' },
];

const DEFAULT_SHORTCUTS: Record<string, string> = {
  'Save': '⌘+S',
  'Find': '⌘+F',
  'Find & Replace': '⌘+H',
  'Bold': '⌘+B',
  'Italic': '⌘+I',
  'Underline': '⌘+U',
  'Undo': '⌘+Z',
  'Redo': '⌘+⇧+Z',
  'Print': '⌘+P',
  'Preferences': '⌘+,',
  'Shortcuts Help': '⌘+/',
  'Version History': '⌘+⇧+H',
  'Insert Citation': '⌘+⇧+C',
  'Toggle Comments': '⌘+⇧+M',
};

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 13,
  border: '1px solid var(--border-color, #dadce0)', background: 'var(--bg-surface, #fff)',
  color: 'var(--text-primary, #202124)',
};
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as any };
const rowStyle: React.CSSProperties = { marginBottom: 16 };

export default function UserPreferences({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('general');
  const { prefs, update, reset } = usePreferences();
  const [rebinding, setRebinding] = useState<string | null>(null);

  // Cmd+, to open is handled elsewhere; Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const imported = importPreferences(text);
      if (imported) {
        update(imported);
      } else {
        alert('Invalid preferences file');
      }
    };
    input.click();
  };

  const handleExport = () => {
    const blob = new Blob([exportPreferences(prefs)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'md-office-preferences.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRebind = (action: string) => {
    setRebinding(action);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('⌘');
      if (e.shiftKey) parts.push('⇧');
      if (e.altKey) parts.push('⌥');
      if (!['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      if (parts.length > 0 && !['⌘', '⇧', '⌥'].includes(parts[parts.length - 1])) {
        const binding = parts.join('+');
        update({ customKeybindings: { ...prefs.customKeybindings, [action]: binding } });
        setRebinding(null);
        window.removeEventListener('keydown', handler, true);
      }
    };
    window.addEventListener('keydown', handler, true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.4)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-surface, #fff)', borderRadius: 12, width: 640, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,.2)',
        color: 'var(--text-primary, #202124)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border-color, #dadce0)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>Preferences</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleImport} title="Import preferences" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit' }}>
              <Upload size={16} />
            </button>
            <button onClick={handleExport} title="Export preferences" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit' }}>
              <Download size={16} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Tabs sidebar */}
          <div style={{
            width: 140, borderRight: '1px solid var(--border-color, #dadce0)',
            padding: '8px 0', flexShrink: 0,
          }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px',
                  fontSize: 13, border: 'none', cursor: 'pointer',
                  background: tab === t.key ? 'var(--hover-bg, #e8f0fe)' : 'transparent',
                  fontWeight: tab === t.key ? 600 : 400,
                  color: tab === t.key ? 'var(--pref-accent-color, #1a73e8)' : 'inherit',
                  borderLeft: tab === t.key ? `3px solid var(--pref-accent-color, #1a73e8)` : '3px solid transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            {tab === 'general' && (
              <>
                <div style={rowStyle}>
                  <label style={labelStyle}>Default File Format</label>
                  <select value={prefs.defaultFormat} onChange={e => update({ defaultFormat: e.target.value as any })} style={selectStyle}>
                    <option value="md">Markdown (.md)</option>
                    <option value="txt">Plain Text (.txt)</option>
                    <option value="html">HTML (.html)</option>
                  </select>
                </div>
                <div style={rowStyle}>
                  <label style={labelStyle}>Auto-save Interval (seconds, 0 = off)</label>
                  <input type="number" min={0} max={60} value={prefs.autoSaveInterval} onChange={e => update({ autoSaveInterval: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <label style={labelStyle}>Spell Check Language</label>
                  <select value={prefs.spellCheckLanguage} onChange={e => update({ spellCheckLanguage: e.target.value })} style={selectStyle}>
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="pt">Portuguese</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
                <div style={rowStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={prefs.showWordCount} onChange={e => update({ showWordCount: e.target.checked })} />
                    Show word count in status bar
                  </label>
                </div>
              </>
            )}

            {tab === 'editor' && (
              <>
                <div style={rowStyle}>
                  <label style={labelStyle}>Font Family</label>
                  <select value={prefs.fontFamily} onChange={e => update({ fontFamily: e.target.value })} style={selectStyle}>
                    <option value="system-ui, sans-serif">System Default</option>
                    <option value="'Georgia', serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Arial', sans-serif">Arial</option>
                    <option value="'Helvetica Neue', sans-serif">Helvetica Neue</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 16, ...rowStyle }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Font Size (px)</label>
                    <input type="number" min={10} max={32} value={prefs.fontSize} onChange={e => update({ fontSize: Number(e.target.value) })} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Line Height</label>
                    <input type="number" min={1} max={3} step={0.1} value={prefs.lineHeight} onChange={e => update({ lineHeight: Number(e.target.value) })} style={inputStyle} />
                  </div>
                </div>
                <div style={rowStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={prefs.showInvisibles} onChange={e => update({ showInvisibles: e.target.checked })} />
                    Show invisibles (spaces, tabs, line breaks)
                  </label>
                </div>
                <div style={rowStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={prefs.showRuler} onChange={e => update({ showRuler: e.target.checked })} />
                    Show ruler
                  </label>
                </div>
                <div style={rowStyle}>
                  <label style={labelStyle}>Default Zoom (%)</label>
                  <input type="range" min={50} max={200} step={10} value={prefs.defaultZoom} onChange={e => update({ defaultZoom: Number(e.target.value) })} style={{ width: '100%' }} />
                  <span style={{ fontSize: 12, color: '#5f6368' }}>{prefs.defaultZoom}%</span>
                </div>
                <div style={rowStyle}>
                  <label style={labelStyle}>Cursor Style</label>
                  <select value={prefs.cursorStyle} onChange={e => update({ cursorStyle: e.target.value as any })} style={selectStyle}>
                    <option value="line">Line</option>
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                  </select>
                </div>
              </>
            )}

            {tab === 'theme' && <ThemeCustomizer />}

            {tab === 'collaboration' && (
              <>
                <div style={rowStyle}>
                  <label style={labelStyle}>Display Name</label>
                  <input type="text" value={prefs.displayName} onChange={e => update({ displayName: e.target.value })} style={inputStyle} placeholder="Your name" />
                </div>
                <div style={rowStyle}>
                  <label style={labelStyle}>Cursor Color</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {ACCENT_PRESETS.map(c => (
                      <button key={c} onClick={() => update({ cursorColor: c })} style={{
                        width: 28, height: 28, borderRadius: '50%', background: c, border: prefs.cursorColor === c ? '3px solid #202124' : '2px solid transparent',
                        cursor: 'pointer', padding: 0,
                      }} />
                    ))}
                  </div>
                </div>
                <div style={rowStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={prefs.showOtherCursors} onChange={e => update({ showOtherCursors: e.target.checked })} />
                    Show other users' cursors
                  </label>
                </div>
                <div style={rowStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={prefs.notificationSounds} onChange={e => update({ notificationSounds: e.target.checked })} />
                    Notification sounds
                  </label>
                </div>
              </>
            )}

            {tab === 'keyboard' && (
              <>
                <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 12 }}>
                  Click a shortcut to rebind it. Press your new key combination.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(DEFAULT_SHORTCUTS).map(([action, defaultKey]) => {
                    const current = prefs.customKeybindings[action] || defaultKey;
                    const isRebinding = rebinding === action;
                    return (
                      <div key={action} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', borderRadius: 6,
                        background: isRebinding ? 'rgba(26,115,232,.1)' : 'transparent',
                      }}>
                        <span style={{ fontSize: 13 }}>{action}</span>
                        <button
                          onClick={() => handleRebind(action)}
                          style={{
                            background: 'var(--hover-bg, #f1f3f4)', border: '1px solid var(--border-color, #dadce0)',
                            borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                            fontFamily: 'monospace', minWidth: 80, textAlign: 'center',
                            color: isRebinding ? 'var(--pref-accent-color, #1a73e8)' : 'inherit',
                          }}
                        >
                          {isRebinding ? 'Press keys…' : current}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => update({ customKeybindings: {} })}
                    style={{
                      fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
                      color: '#e6334a', textDecoration: 'underline',
                    }}
                  >
                    Reset all to defaults
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', borderTop: '1px solid var(--border-color, #dadce0)',
        }}>
          <button onClick={() => { reset(); }} style={{
            fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#e6334a',
          }}>
            Reset All to Defaults
          </button>
          <button onClick={onClose} style={{
            padding: '6px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--pref-accent-color, #1a73e8)', color: '#fff', fontSize: 13, fontWeight: 500,
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
