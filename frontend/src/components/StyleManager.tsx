import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, X, Plus, Palette } from 'lucide-react';
import { styleEngine, StyleDefinition } from '../lib/styleEngine';

interface StyleManagerProps {
  editor: any;
  mode?: 'toolbar' | 'panel';
}

/** Modify Style dialog */
const ModifyStyleDialog: React.FC<{
  style: StyleDefinition;
  onSave: (updated: Partial<StyleDefinition>) => void;
  onClose: () => void;
}> = ({ style, onSave, onClose }) => {
  const resolved = styleEngine.resolveStyle(style.name);
  const [fontFamily, setFontFamily] = useState(resolved.fontFamily || 'Arial, sans-serif');
  const [fontSize, setFontSize] = useState(resolved.fontSize || '11pt');
  const [color, setColor] = useState(resolved.color || '#000000');
  const [bold, setBold] = useState(resolved.bold || false);
  const [italic, setItalic] = useState(resolved.italic || false);
  const [underline, setUnderline] = useState(resolved.underline || false);
  const [lineSpacing, setLineSpacing] = useState(resolved.lineSpacing || '1.15');
  const [spaceBefore, setSpaceBefore] = useState(resolved.spaceBefore || '0pt');
  const [spaceAfter, setSpaceAfter] = useState(resolved.spaceAfter || '8pt');
  const [alignment, setAlignment] = useState<StyleDefinition['alignment']>(resolved.alignment || 'left');
  const [indent, setIndent] = useState(resolved.indent || '');

  const handleSave = () => {
    onSave({ fontFamily, fontSize, color, bold, italic, underline, lineSpacing, spaceBefore, spaceAfter, alignment, indent: indent || undefined });
    onClose();
  };

  return (
    <div className="style-dialog-overlay" onClick={onClose}>
      <div className="style-dialog" onClick={e => e.stopPropagation()}>
        <div className="style-dialog-header">
          <h3>Modify Style: {style.name}</h3>
          <button className="toolbar-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="style-dialog-body">
          <div className="style-dialog-preview" style={{
            fontFamily, fontSize, color,
            fontWeight: bold ? 'bold' : 'normal',
            fontStyle: italic ? 'italic' : 'normal',
            textDecoration: underline ? 'underline' : 'none',
            textAlign: alignment,
            lineHeight: lineSpacing,
          }}>
            {style.name} preview text
          </div>
          <div className="style-dialog-grid">
            <label>Font Family
              <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
                {['Arial, sans-serif', 'Times New Roman, serif', 'Georgia, serif', 'Helvetica, sans-serif', 'Courier New, monospace', 'Verdana, sans-serif'].map(f => (
                  <option key={f} value={f}>{f.split(',')[0]}</option>
                ))}
              </select>
            </label>
            <label>Font Size
              <select value={fontSize} onChange={e => setFontSize(e.target.value)}>
                {['8pt','9pt','10pt','10.5pt','11pt','12pt','14pt','16pt','18pt','20pt','24pt','26pt','28pt','30pt','36pt'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>Color
              <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            </label>
            <label>Alignment
              <select value={alignment} onChange={e => setAlignment(e.target.value as StyleDefinition['alignment'])}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </label>
            <label>Line Spacing
              <select value={lineSpacing} onChange={e => setLineSpacing(e.target.value)}>
                {['1.0','1.15','1.5','2','2.5','3'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Space Before
              <input type="text" value={spaceBefore} onChange={e => setSpaceBefore(e.target.value)} placeholder="e.g. 8pt" />
            </label>
            <label>Space After
              <input type="text" value={spaceAfter} onChange={e => setSpaceAfter(e.target.value)} placeholder="e.g. 8pt" />
            </label>
            <label>Indent
              <input type="text" value={indent} onChange={e => setIndent(e.target.value)} placeholder="e.g. 1.5em" />
            </label>
          </div>
          <div className="style-dialog-toggles">
            <label><input type="checkbox" checked={bold} onChange={e => setBold(e.target.checked)} /> <strong>Bold</strong></label>
            <label><input type="checkbox" checked={italic} onChange={e => setItalic(e.target.checked)} /> <em>Italic</em></label>
            <label><input type="checkbox" checked={underline} onChange={e => setUnderline(e.target.checked)} /> <u>Underline</u></label>
          </div>
        </div>
        <div className="style-dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>OK</button>
        </div>
      </div>
    </div>
  );
};

/** New Style dialog */
const NewStyleDialog: React.FC<{
  editor: any;
  onClose: () => void;
}> = ({ editor, onClose }) => {
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    styleEngine.createStyleFromSelection(editor, name.trim());
    onClose();
  };

  return (
    <div className="style-dialog-overlay" onClick={onClose}>
      <div className="style-dialog style-dialog-small" onClick={e => e.stopPropagation()}>
        <div className="style-dialog-header">
          <h3>New Style from Selection</h3>
          <button className="toolbar-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="style-dialog-body">
          <label>Style Name
            <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="My Custom Style" />
          </label>
        </div>
        <div className="style-dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleCreate} disabled={!name.trim()}>Create</button>
        </div>
      </div>
    </div>
  );
};

const StyleManager: React.FC<StyleManagerProps> = ({ editor, mode = 'toolbar' }) => {
  const [showGallery, setShowGallery] = useState(false);
  const [showModify, setShowModify] = useState<StyleDefinition | null>(null);
  const [showNewStyle, setShowNewStyle] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [, setTick] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return styleEngine.subscribe(() => setTick(t => t + 1));
  }, []);

  // Close gallery on outside click
  useEffect(() => {
    if (!showGallery) return;
    const handler = (e: MouseEvent) => {
      if (galleryRef.current && !galleryRef.current.contains(e.target as Node)) {
        setShowGallery(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGallery]);

  const activeStyle = editor ? styleEngine.getActiveStyle(editor) : 'Normal';
  const allStyles = styleEngine.getAllStyles();
  const themes = styleEngine.getQuickStyleSets();

  const handleApplyStyle = useCallback((name: string) => {
    if (editor) {
      styleEngine.applyStyle(editor, name);
    }
    setShowGallery(false);
  }, [editor]);

  const handleModifySave = useCallback((updates: Partial<StyleDefinition>) => {
    if (showModify) {
      styleEngine.updateStyle(showModify.name, updates);
    }
  }, [showModify]);

  const handleApplyTheme = useCallback((themeName: string) => {
    styleEngine.applyQuickStyleSet(themeName);
    setShowThemes(false);
  }, []);

  if (mode === 'panel') {
    return (
      <div className="style-manager-panel">
        <div className="style-panel-header">
          <h4>Styles</h4>
          <button className="toolbar-btn" onClick={() => setShowNewStyle(true)} title="New Style from Selection"><Plus size={14} /></button>
        </div>
        <div className="style-panel-list">
          {allStyles.map(s => {
            const resolved = styleEngine.resolveStyle(s.name);
            return (
              <div
                key={s.name}
                className={`style-panel-item${activeStyle === s.name ? ' active' : ''}`}
                onClick={() => handleApplyStyle(s.name)}
                onContextMenu={e => { e.preventDefault(); setShowModify(s); }}
              >
                <span className="style-panel-preview" style={{
                  fontFamily: resolved.fontFamily,
                  fontSize: Math.min(parseInt(resolved.fontSize || '11') * 0.8, 16) + 'px',
                  fontWeight: resolved.bold ? 'bold' : 'normal',
                  fontStyle: resolved.italic ? 'italic' : 'normal',
                  color: resolved.color,
                }}>
                  {s.name}
                </span>
                {!s.isBuiltIn && (
                  <button className="style-panel-delete" onClick={e => { e.stopPropagation(); styleEngine.deleteStyle(s.name); }}>×</button>
                )}
              </div>
            );
          })}
        </div>
        <div className="style-panel-themes">
          <h5>Quick Style Sets</h5>
          {themes.map(t => (
            <button key={t.name} className="style-theme-btn" onClick={() => handleApplyTheme(t.name)}>{t.name}</button>
          ))}
        </div>
        {showModify && <ModifyStyleDialog style={showModify} onSave={handleModifySave} onClose={() => setShowModify(null)} />}
        {showNewStyle && <NewStyleDialog editor={editor} onClose={() => setShowNewStyle(false)} />}
      </div>
    );
  }

  // Toolbar mode: compact style gallery dropdown
  return (
    <div className="dropdown-container style-manager-toolbar" ref={galleryRef}>
      <button
        className="toolbar-dropdown-btn"
        onClick={() => setShowGallery(!showGallery)}
        title="Styles"
        style={{ minWidth: '80px' }}
      >
        <Palette size={14} />
        <span style={{ marginLeft: 4 }}>{activeStyle}</span>
        <ChevronDown size={12} />
      </button>
      {showGallery && (
        <div className="style-gallery-dropdown">
          <div className="style-gallery-grid">
            {allStyles.filter(s => s.category === 'paragraph').map(s => {
              const resolved = styleEngine.resolveStyle(s.name);
              return (
                <button
                  key={s.name}
                  className={`style-gallery-item${activeStyle === s.name ? ' active' : ''}`}
                  onClick={() => handleApplyStyle(s.name)}
                  onContextMenu={e => { e.preventDefault(); setShowModify(s); setShowGallery(false); }}
                  title={`${s.name} (right-click to modify)`}
                >
                  <span style={{
                    fontFamily: resolved.fontFamily,
                    fontSize: Math.min(parseInt(resolved.fontSize || '11') * 0.7, 14) + 'px',
                    fontWeight: resolved.bold ? 'bold' : 'normal',
                    fontStyle: resolved.italic ? 'italic' : 'normal',
                    color: resolved.color,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="style-gallery-actions">
            <button className="style-gallery-action" onClick={() => { setShowNewStyle(true); setShowGallery(false); }}>
              <Plus size={12} /> New Style from Selection
            </button>
            <button className="style-gallery-action" onClick={() => { setShowThemes(!showThemes); }}>
              <Palette size={12} /> Quick Style Sets
            </button>
          </div>
          {showThemes && (
            <div className="style-themes-list">
              {themes.map(t => (
                <button key={t.name} className="style-theme-btn" onClick={() => handleApplyTheme(t.name)}>{t.name}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {showModify && <ModifyStyleDialog style={showModify} onSave={handleModifySave} onClose={() => setShowModify(null)} />}
      {showNewStyle && <NewStyleDialog editor={editor} onClose={() => setShowNewStyle(false)} />}
    </div>
  );
};

export default StyleManager;
