// Enhanced cell styling panel — borders, text rotation, overflow, indent, diagonal
import { useState } from 'react';
import type { CellFormat, BorderStyle, BorderLineStyle, TextOverflow } from './cellFormat';

interface CellStyleProps {
  format: CellFormat;
  onFormatChange: (updates: Partial<CellFormat>) => void;
  onClose: () => void;
}

const BORDER_STYLES: BorderStyle[] = ['none', 'thin', 'thick'];
const LINE_STYLES: BorderLineStyle[] = ['solid', 'dashed', 'dotted', 'double'];
const ROTATION_OPTIONS = [
  { label: '0°', value: 0 },
  { label: '45°', value: 45 },
  { label: '90°', value: 90 },
  { label: '-45°', value: -45 },
  { label: 'Vertical', value: 270 },
];
const OVERFLOW_OPTIONS: { label: string; value: TextOverflow }[] = [
  { label: 'Wrap', value: 'wrap' },
  { label: 'Overflow', value: 'overflow' },
  { label: 'Clip', value: 'clip' },
];

export default function CellStylePanel({ format, onFormatChange, onClose }: CellStyleProps) {
  const [borderColor, setBorderColor] = useState('#333333');
  const [borderLine, setBorderLine] = useState<BorderLineStyle>('solid');
  const [borderWeight, setBorderWeight] = useState<BorderStyle>('thin');

  const makeBorder = () => ({ style: borderWeight, lineStyle: borderLine, color: borderColor });

  const applyBorder = (sides: ('top' | 'right' | 'bottom' | 'left')[]) => {
    const borders = { ...(format.borders || {}) };
    for (const side of sides) {
      (borders as Record<string, unknown>)[side] = makeBorder();
    }
    onFormatChange({ borders });
  };

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      background: '#fff', border: '1px solid #ccc', borderRadius: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 2000, padding: 20, width: 420,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Cell Style</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Border Settings */}
      <fieldset style={{ marginBottom: 12, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4 }}>
        <legend style={{ fontSize: 12, fontWeight: 600 }}>Borders</legend>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 11 }}>Weight:</label>
          <select value={borderWeight} onChange={e => setBorderWeight(e.target.value as BorderStyle)} style={{ fontSize: 11 }}>
            {BORDER_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ fontSize: 11 }}>Style:</label>
          <select value={borderLine} onChange={e => setBorderLine(e.target.value as BorderLineStyle)} style={{ fontSize: 11 }}>
            {LINE_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ fontSize: 11 }}>Color:</label>
          <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} style={{ width: 24, height: 24 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="sheet-tb-btn" onClick={() => applyBorder(['top'])} title="Top border">▔</button>
          <button className="sheet-tb-btn" onClick={() => applyBorder(['bottom'])} title="Bottom border">▁</button>
          <button className="sheet-tb-btn" onClick={() => applyBorder(['left'])} title="Left border">▏</button>
          <button className="sheet-tb-btn" onClick={() => applyBorder(['right'])} title="Right border">▕</button>
          <button className="sheet-tb-btn" onClick={() => applyBorder(['top', 'right', 'bottom', 'left'])} title="All borders">▣</button>
          <button className="sheet-tb-btn" onClick={() => {
            onFormatChange({ borders: { top: 'none', right: 'none', bottom: 'none', left: 'none' } });
          }} title="No borders">☐</button>
          <button className="sheet-tb-btn" onClick={() => {
            const borders = { ...(format.borders || {}) };
            borders.diagonal = { style: borderWeight, lineStyle: borderLine, color: borderColor };
            onFormatChange({ borders });
          }} title="Diagonal">⟋</button>
        </div>
      </fieldset>

      {/* Text Rotation */}
      <fieldset style={{ marginBottom: 12, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4 }}>
        <legend style={{ fontSize: 12, fontWeight: 600 }}>Text Rotation</legend>
        <div style={{ display: 'flex', gap: 4 }}>
          {ROTATION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`sheet-tb-btn ${format.textRotation === opt.value ? 'active' : ''}`}
              onClick={() => onFormatChange({ textRotation: opt.value })}
              style={{ fontSize: 11 }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Text Overflow */}
      <fieldset style={{ marginBottom: 12, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4 }}>
        <legend style={{ fontSize: 12, fontWeight: 600 }}>Text Overflow</legend>
        <div style={{ display: 'flex', gap: 4 }}>
          {OVERFLOW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`sheet-tb-btn ${(format.textOverflow || 'wrap') === opt.value ? 'active' : ''}`}
              onClick={() => onFormatChange({ textOverflow: opt.value, wrap: opt.value === 'wrap' })}
              style={{ fontSize: 11 }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Indent */}
      <fieldset style={{ marginBottom: 12, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4 }}>
        <legend style={{ fontSize: 12, fontWeight: 600 }}>Indent</legend>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="sheet-tb-btn" onClick={() => onFormatChange({ indentLevel: Math.max(0, (format.indentLevel || 0) - 1) })}>◀</button>
          <span style={{ fontSize: 12, minWidth: 20, textAlign: 'center' }}>{format.indentLevel || 0}</span>
          <button className="sheet-tb-btn" onClick={() => onFormatChange({ indentLevel: (format.indentLevel || 0) + 1 })}>▶</button>
        </div>
      </fieldset>
    </div>
  );
}

/** Compact toolbar section for quick border/style access */
export function CellStyleToolbar({ format, onFormatChange, onOpenPanel }: {
  format: CellFormat;
  onFormatChange: (updates: Partial<CellFormat>) => void;
  onOpenPanel: () => void;
}) {
  return (
    <>
      <button className="sheet-tb-btn" onClick={() => {
        onFormatChange({ borders: { top: 'thin', right: 'thin', bottom: 'thin', left: 'thin' } });
      }} title="All borders">▣</button>
      <button className="sheet-tb-btn" onClick={() => {
        onFormatChange({ borders: { top: 'none', right: 'none', bottom: 'none', left: 'none' } });
      }} title="No borders">☐</button>
      <button className="sheet-tb-btn" onClick={onOpenPanel} title="Cell style...">🎨</button>
      <button className="sheet-tb-btn" onClick={() => {
        onFormatChange({ indentLevel: (format.indentLevel || 0) + 1 });
      }} title="Increase indent">→|</button>
    </>
  );
}
