import { useState } from 'react';

export interface PrintSettings {
  orientation: 'portrait' | 'landscape';
  paperSize: 'letter' | 'a4' | 'legal';
  margins: 'normal' | 'narrow' | 'wide' | 'custom';
  customMargins: { top: number; right: number; bottom: number; left: number };
  scaleFit: 'none' | 'fitWidth' | 'fitHeight' | 'fitPage' | 'custom';
  customScale: number;
  printArea: 'all' | 'selection' | 'namedRange';
  namedRange: string;
  repeatRows: number; // 0 = none, else repeat first N rows
  repeatCols: number;
  gridlines: boolean;
  rowColHeaders: boolean;
  pageOrder: 'downThenOver' | 'overThenDown';
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
}

export const defaultPrintSettings: PrintSettings = {
  orientation: 'portrait',
  paperSize: 'letter',
  margins: 'normal',
  customMargins: { top: 0.75, right: 0.7, bottom: 0.75, left: 0.7 },
  scaleFit: 'none',
  customScale: 100,
  printArea: 'all',
  namedRange: '',
  repeatRows: 0,
  repeatCols: 0,
  gridlines: true,
  rowColHeaders: false,
  pageOrder: 'downThenOver',
  headerLeft: '',
  headerCenter: '&{sheet}',
  headerRight: '',
  footerLeft: '',
  footerCenter: 'Page {page} of {pages}',
  footerRight: '{date}',
};

interface SheetPrintSetupProps {
  settings: PrintSettings;
  onApply: (s: PrintSettings) => void;
  onClose: () => void;
  onPreview: () => void;
  namedRanges?: string[];
}

const sectionStyle: React.CSSProperties = { marginBottom: 16 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#444' };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 };
const selectStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 };
const inputStyle: React.CSSProperties = { width: 60, padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 };
const tokenHint: React.CSSProperties = { fontSize: 11, color: '#888', marginTop: 2 };

export default function SheetPrintSetup({ settings: initial, onApply, onClose, onPreview, namedRanges = [] }: SheetPrintSetupProps) {
  const [s, setS] = useState<PrintSettings>({ ...initial });
  const upd = (patch: Partial<PrintSettings>) => setS(prev => ({ ...prev, ...patch }));

  return (
    <div className="sheet-dialog-overlay" onClick={onClose}>
      <div className="sheet-dialog" style={{ width: 520, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>Page Setup</h3>

        {/* Orientation & Paper */}
        <div style={sectionStyle}>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Orientation</label>
              <select style={selectStyle} value={s.orientation} onChange={e => upd({ orientation: e.target.value as any })}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Paper Size</label>
              <select style={selectStyle} value={s.paperSize} onChange={e => upd({ paperSize: e.target.value as any })}>
                <option value="letter">Letter (8.5×11″)</option>
                <option value="a4">A4 (210×297mm)</option>
                <option value="legal">Legal (8.5×14″)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Margins */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Margins</label>
          <div style={rowStyle}>
            <select style={selectStyle} value={s.margins} onChange={e => upd({ margins: e.target.value as any })}>
              <option value="normal">Normal</option>
              <option value="narrow">Narrow</option>
              <option value="wide">Wide</option>
              <option value="custom">Custom</option>
            </select>
            {s.margins === 'custom' && (
              <>
                {(['top', 'right', 'bottom', 'left'] as const).map(side => (
                  <label key={side} style={{ fontSize: 12 }}>
                    {side[0].toUpperCase() + side.slice(1)}:
                    <input type="number" step={0.1} min={0} style={inputStyle} value={s.customMargins[side]}
                      onChange={e => upd({ customMargins: { ...s.customMargins, [side]: parseFloat(e.target.value) || 0 } })} />″
                  </label>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Scale */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Scale to Fit</label>
          <div style={rowStyle}>
            <select style={selectStyle} value={s.scaleFit} onChange={e => upd({ scaleFit: e.target.value as any })}>
              <option value="none">Actual size (100%)</option>
              <option value="fitWidth">Fit all columns on one page</option>
              <option value="fitHeight">Fit all rows on one page</option>
              <option value="fitPage">Fit sheet on one page</option>
              <option value="custom">Custom scale</option>
            </select>
            {s.scaleFit === 'custom' && (
              <label style={{ fontSize: 12 }}>
                <input type="number" min={10} max={400} style={inputStyle} value={s.customScale}
                  onChange={e => upd({ customScale: parseInt(e.target.value) || 100 })} />%
              </label>
            )}
          </div>
        </div>

        {/* Print Area */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Print Area</label>
          <div style={rowStyle}>
            <select style={selectStyle} value={s.printArea} onChange={e => upd({ printArea: e.target.value as any })}>
              <option value="all">Entire sheet</option>
              <option value="selection">Current selection</option>
              {namedRanges.length > 0 && <option value="namedRange">Named range</option>}
            </select>
            {s.printArea === 'namedRange' && (
              <select style={selectStyle} value={s.namedRange} onChange={e => upd({ namedRange: e.target.value })}>
                <option value="">Select…</option>
                {namedRanges.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Repeat Rows/Cols */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Repeat on Each Page</label>
          <div style={rowStyle}>
            <label style={{ fontSize: 12 }}>Repeat top rows: <input type="number" min={0} max={50} style={inputStyle} value={s.repeatRows} onChange={e => upd({ repeatRows: parseInt(e.target.value) || 0 })} /></label>
            <label style={{ fontSize: 12 }}>Repeat left cols: <input type="number" min={0} max={50} style={inputStyle} value={s.repeatCols} onChange={e => upd({ repeatCols: parseInt(e.target.value) || 0 })} /></label>
          </div>
        </div>

        {/* Options */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Options</label>
          <div style={rowStyle}>
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={s.gridlines} onChange={e => upd({ gridlines: e.target.checked })} /> Print gridlines</label>
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={s.rowColHeaders} onChange={e => upd({ rowColHeaders: e.target.checked })} /> Row & column headers</label>
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>Page order:</label>
            <select style={selectStyle} value={s.pageOrder} onChange={e => upd({ pageOrder: e.target.value as any })}>
              <option value="downThenOver">Down, then over</option>
              <option value="overThenDown">Over, then down</option>
            </select>
          </div>
        </div>

        {/* Header/Footer */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Header</label>
          <div style={rowStyle}>
            <input style={{ ...inputStyle, width: 140 }} placeholder="Left" value={s.headerLeft} onChange={e => upd({ headerLeft: e.target.value })} />
            <input style={{ ...inputStyle, width: 140 }} placeholder="Center" value={s.headerCenter} onChange={e => upd({ headerCenter: e.target.value })} />
            <input style={{ ...inputStyle, width: 140 }} placeholder="Right" value={s.headerRight} onChange={e => upd({ headerRight: e.target.value })} />
          </div>
          <label style={labelStyle}>Footer</label>
          <div style={rowStyle}>
            <input style={{ ...inputStyle, width: 140 }} placeholder="Left" value={s.footerLeft} onChange={e => upd({ footerLeft: e.target.value })} />
            <input style={{ ...inputStyle, width: 140 }} placeholder="Center" value={s.footerCenter} onChange={e => upd({ footerCenter: e.target.value })} />
            <input style={{ ...inputStyle, width: 140 }} placeholder="Right" value={s.footerRight} onChange={e => upd({ footerRight: e.target.value })} />
          </div>
          <div style={tokenHint}>Tokens: {'{page}'} {'{pages}'} {'{date}'} {'{sheet}'}</div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="sheet-tb-btn" onClick={onClose}>Cancel</button>
          <button className="sheet-tb-btn" onClick={() => { onApply(s); onPreview(); }}>Preview</button>
          <button className="sheet-tb-btn" style={{ background: '#1a73e8', color: '#fff' }} onClick={() => onApply(s)}>Apply</button>
        </div>
      </div>
    </div>
  );
}
