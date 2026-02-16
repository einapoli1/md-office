import { usePreferences, ACCENT_PRESETS } from '../lib/preferencesStore';

export default function ThemeCustomizer() {
  const { prefs, update } = usePreferences();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Accent color */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>Accent Color</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCENT_PRESETS.map(c => (
            <button
              key={c}
              onClick={() => update({ accentColor: c })}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: prefs.accentColor === c ? '3px solid #202124' : '2px solid transparent',
                background: c, cursor: 'pointer', padding: 0, outline: 'none',
              }}
              title={c}
              aria-label={`Accent color ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Custom CSS */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
          Custom CSS <span style={{ fontWeight: 400, color: '#5f6368' }}>(advanced)</span>
        </label>
        <div style={{ fontSize: 11, color: '#5f6368', marginBottom: 6 }}>
          Use CSS variables: <code>--pref-accent-color</code>, <code>--pref-font-family</code>, <code>--pref-font-size</code>
        </div>
        <textarea
          value={prefs.customCSS}
          onChange={e => update({ customCSS: e.target.value })}
          placeholder={`/* Example */\n.ProseMirror {\n  color: navy;\n}`}
          style={{
            width: '100%', height: 120, fontFamily: 'monospace', fontSize: 12,
            padding: 8, borderRadius: 6, border: '1px solid var(--border-color, #dadce0)',
            resize: 'vertical', background: 'var(--bg-surface, #fff)',
            color: 'var(--text-primary, #202124)',
          }}
        />
      </div>

      {/* Live preview */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>Live Preview</label>
        <div style={{
          border: '1px solid var(--border-color, #dadce0)', borderRadius: 8, padding: 16,
          fontFamily: prefs.fontFamily, fontSize: prefs.fontSize, lineHeight: prefs.lineHeight,
          background: '#fff', color: '#202124', maxHeight: 180, overflow: 'auto',
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: prefs.fontSize * 1.3 }}>Document Title</h3>
          <p style={{ margin: '0 0 6px' }}>
            This is a preview paragraph showing your current font and sizing preferences.
            Links look like <span style={{ color: prefs.accentColor, textDecoration: 'underline' }}>this hyperlink</span> with
            your chosen accent color.
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ background: `${prefs.accentColor}30`, padding: '1px 3px', borderRadius: 2 }}>Selected text</span> uses
            the accent as a highlight. The toolbar would use{' '}
            <span style={{ background: prefs.accentColor, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
              this style
            </span>{' '}
            for active buttons.
          </p>
        </div>
      </div>
    </div>
  );
}
