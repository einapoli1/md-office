import { CellFormat, NumberFormat, TextAlign } from './cellFormat';

interface SheetToolbarProps {
  format: CellFormat;
  onFormatChange: (updates: Partial<CellFormat>) => void;
  onMergeCells: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function SheetToolbar({ format, onFormatChange, onMergeCells, canUndo, canRedo, onUndo, onRedo }: SheetToolbarProps) {
  return (
    <div className="sheet-toolbar">
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
    </div>
  );
}
