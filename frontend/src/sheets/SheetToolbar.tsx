import { useState, useRef } from 'react';
import { CellFormat, NumberFormat, TextAlign } from './cellFormat';
import { FreezePanes } from './sheetModel';

interface SheetToolbarProps {
  format: CellFormat;
  onFormatChange: (updates: Partial<CellFormat>) => void;
  onMergeCells: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInsertChart: () => void;
  filtersEnabled: boolean;
  onToggleFilters: () => void;
  freeze: FreezePanes;
  onFreezeChange: (freeze: FreezePanes) => void;
  onImportCSV?: (file: File) => void;
  onImportXLSX?: (file: File) => void;
  onExportCSV?: () => void;
  onExportXLSX?: () => void;
  onConditionalFormat?: () => void;
  onDataValidation?: () => void;
  onPivotTable?: () => void;
  onNamedRanges?: () => void;
  onInsertComment?: () => void;
  onProtectedRanges?: () => void;
  onFindReplace?: () => void;
}

export default function SheetToolbar({ format, onFormatChange, onMergeCells, canUndo, canRedo, onUndo, onRedo, onInsertChart, filtersEnabled, onToggleFilters, freeze, onFreezeChange, onImportCSV, onImportXLSX, onExportCSV, onExportXLSX, onConditionalFormat, onDataValidation, onPivotTable, onNamedRanges, onInsertComment, onProtectedRanges, onFindReplace }: SheetToolbarProps) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'csv' | 'xlsx'>('csv');
  return (
    <div className="sheet-toolbar">
      {/* File menu */}
      <div style={{ position: 'relative' }}>
        <button className="sheet-tb-btn" onClick={() => setFileMenuOpen(!fileMenuOpen)} title="File">📁</button>
        {fileMenuOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, padding: '4px 0', minWidth: 180, whiteSpace: 'nowrap' }} onClick={() => setFileMenuOpen(false)}>
            <div style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => { setImportMode('csv'); fileInputRef.current!.accept = '.csv'; fileInputRef.current!.click(); }}>📥 Import CSV</div>
            <div style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => { setImportMode('xlsx'); fileInputRef.current!.accept = '.xlsx,.xls'; fileInputRef.current!.click(); }}>📥 Import XLSX</div>
            <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
            <div style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => onExportCSV?.()}>📤 Download as CSV</div>
            <div style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => onExportXLSX?.()}>📤 Download as XLSX</div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (importMode === 'csv') onImportCSV?.(file);
            else onImportXLSX?.(file);
            e.target.value = '';
          }}
        />
      </div>
      <span className="sheet-tb-sep" />

      {/* Undo/Redo */}
      <button className="sheet-tb-btn" disabled={!canUndo} onClick={onUndo} title="Undo">↶</button>
      <button className="sheet-tb-btn" disabled={!canRedo} onClick={onRedo} title="Redo">↷</button>
      <span className="sheet-tb-sep" />

      {/* Font */}
      <select
        className="sheet-tb-select"
        value={format.fontFamily || 'Arial'}
        onChange={e => onFormatChange({ fontFamily: e.target.value })}
      >
        <option value="Arial">Arial</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
      </select>

      <select
        className="sheet-tb-select sheet-tb-fontsize"
        value={format.fontSize || 13}
        onChange={e => onFormatChange({ fontSize: parseInt(e.target.value) })}
      >
        {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36].map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <span className="sheet-tb-sep" />

      {/* Style */}
      <button className={`sheet-tb-btn ${format.bold ? 'active' : ''}`} onClick={() => onFormatChange({ bold: !format.bold })} title="Bold"><b>B</b></button>
      <button className={`sheet-tb-btn ${format.italic ? 'active' : ''}`} onClick={() => onFormatChange({ italic: !format.italic })} title="Italic"><i>I</i></button>
      <button className={`sheet-tb-btn ${format.underline ? 'active' : ''}`} onClick={() => onFormatChange({ underline: !format.underline })} title="Underline"><u>U</u></button>
      <button className={`sheet-tb-btn ${format.strikethrough ? 'active' : ''}`} onClick={() => onFormatChange({ strikethrough: !format.strikethrough })} title="Strikethrough"><s>S</s></button>
      <span className="sheet-tb-sep" />

      {/* Colors */}
      <label className="sheet-tb-color" title="Text color">
        A
        <input type="color" value={format.textColor || '#000000'} onChange={e => onFormatChange({ textColor: e.target.value })} />
      </label>
      <label className="sheet-tb-color sheet-tb-fill" title="Fill color">
        <span className="fill-icon">⬛</span>
        <input type="color" value={format.backgroundColor || '#ffffff'} onChange={e => onFormatChange({ backgroundColor: e.target.value })} />
      </label>
      <span className="sheet-tb-sep" />

      {/* Borders */}
      <select
        className="sheet-tb-select"
        value=""
        onChange={e => {
          const v = e.target.value;
          if (v === 'all') onFormatChange({ borders: { top: 'thin', right: 'thin', bottom: 'thin', left: 'thin' } });
          else if (v === 'none') onFormatChange({ borders: { top: 'none', right: 'none', bottom: 'none', left: 'none' } });
          else if (v === 'bottom') onFormatChange({ borders: { bottom: 'thin' } });
          e.target.value = '';
        }}
      >
        <option value="" disabled>Borders</option>
        <option value="all">All borders</option>
        <option value="bottom">Bottom border</option>
        <option value="none">No borders</option>
      </select>

      {/* Merge */}
      <button className="sheet-tb-btn" onClick={onMergeCells} title="Merge cells">⊞</button>
      <span className="sheet-tb-sep" />

      {/* Number format */}
      <select
        className="sheet-tb-select"
        value={format.numberFormat || 'general'}
        onChange={e => onFormatChange({ numberFormat: e.target.value as NumberFormat })}
      >
        <option value="general">General</option>
        <option value="number">Number</option>
        <option value="currency">Currency</option>
        <option value="percentage">Percent</option>
        <option value="date">Date</option>
      </select>
      <span className="sheet-tb-sep" />

      {/* Alignment */}
      <button className={`sheet-tb-btn ${format.textAlign === 'left' ? 'active' : ''}`} onClick={() => onFormatChange({ textAlign: 'left' as TextAlign })} title="Align left">≡</button>
      <button className={`sheet-tb-btn ${format.textAlign === 'center' ? 'active' : ''}`} onClick={() => onFormatChange({ textAlign: 'center' as TextAlign })} title="Align center">≡</button>
      <button className={`sheet-tb-btn ${format.textAlign === 'right' ? 'active' : ''}`} onClick={() => onFormatChange({ textAlign: 'right' as TextAlign })} title="Align right">≡</button>

      {/* Wrap */}
      <button className={`sheet-tb-btn ${format.wrap ? 'active' : ''}`} onClick={() => onFormatChange({ wrap: !format.wrap })} title="Text wrap">↩</button>
      <span className="sheet-tb-sep" />

      {/* Chart */}
      <button className="sheet-tb-btn" onClick={onInsertChart} title="Insert chart">📊</button>

      {/* Filter toggle */}
      <button className={`sheet-tb-btn ${filtersEnabled ? 'active' : ''}`} onClick={onToggleFilters} title="Toggle filters">🔽</button>

      {/* Freeze panes */}
      <select
        className="sheet-tb-select"
        value={freeze.rows === 1 && freeze.cols === 0 ? 'row1' : freeze.rows === 0 && freeze.cols === 1 ? 'col1' : freeze.rows === 0 && freeze.cols === 0 ? 'none' : 'custom'}
        onChange={e => {
          const v = e.target.value;
          if (v === 'none') onFreezeChange({ rows: 0, cols: 0 });
          else if (v === 'row1') onFreezeChange({ rows: 1, cols: 0 });
          else if (v === 'col1') onFreezeChange({ rows: 0, cols: 1 });
        }}
      >
        <option value="none">No freeze</option>
        <option value="row1">Freeze first row</option>
        <option value="col1">Freeze first column</option>
        {(freeze.rows > 1 || freeze.cols > 1 || (freeze.rows > 0 && freeze.cols > 0)) && <option value="custom">Custom freeze</option>}
      </select>
      <span className="sheet-tb-sep" />

      {/* Conditional formatting & Data validation */}
      {onConditionalFormat && <button className="sheet-tb-btn" onClick={onConditionalFormat} title="Conditional formatting">🎨</button>}
      {onDataValidation && <button className="sheet-tb-btn" onClick={onDataValidation} title="Data validation">✓</button>}
      <span className="sheet-tb-sep" />
      {onPivotTable && <button className="sheet-tb-btn" onClick={onPivotTable} title="Pivot table">📋</button>}
      {onNamedRanges && <button className="sheet-tb-btn" onClick={onNamedRanges} title="Named ranges">📛</button>}
      <span className="sheet-tb-sep" />
      {onInsertComment && <button className="sheet-tb-btn" onClick={onInsertComment} title="Insert comment">💬</button>}
      {onProtectedRanges && <button className="sheet-tb-btn" onClick={onProtectedRanges} title="Protected ranges">🔒</button>}
      {onFindReplace && <button className="sheet-tb-btn" onClick={onFindReplace} title="Find & Replace">🔍</button>}
    </div>
  );
}
