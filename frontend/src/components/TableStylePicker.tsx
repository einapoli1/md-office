import React, { useState, useRef, useEffect } from 'react';
import { TABLE_STYLE_PRESETS, applyTableStyle, type TableStylePreset } from '../extensions/TableAdvanced';

interface TableStylePickerProps {
  editor: any;
  onClose?: () => void;
  /** Inline = rendered in toolbar dropdown; otherwise standalone popover */
  inline?: boolean;
}

const THUMB_ROWS = 3;
const THUMB_COLS = 3;

/** Render a tiny preview of a table style */
const StyleThumbnail: React.FC<{ preset: TableStylePreset; selected: boolean; onClick: () => void }> = ({
  preset, selected, onClick,
}) => {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < THUMB_ROWS; r++) {
    for (let c = 0; c < THUMB_COLS; c++) {
      const isHeader = r === 0;
      let bg: string;
      if (isHeader) bg = preset.headerBg;
      else if (preset.bandedRows) bg = r % 2 === 0 ? preset.evenRowBg : preset.oddRowBg;
      else bg = 'transparent';

      const borderCol = isHeader ? preset.headerBorderColor : preset.cellBorderColor;
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            width: 20, height: 12,
            backgroundColor: bg === 'transparent' ? '#fff' : bg,
            border: preset.cellBorderStyle === 'none' ? '1px solid #eee' : `${preset.cellBorderWidth} ${preset.cellBorderStyle} ${borderCol}`,
            fontSize: 6, color: isHeader ? preset.headerFg : '#333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isHeader ? 'H' : ''}
        </div>
      );
    }
  }

  return (
    <button
      className="table-style-thumb"
      onClick={onClick}
      title={preset.name}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        padding: 4, margin: 2, cursor: 'pointer',
        border: selected ? '2px solid #2563eb' : '2px solid transparent',
        borderRadius: 4, background: 'none',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${THUMB_COLS}, 20px)`, gap: 0 }}>
        {cells}
      </div>
      <span style={{ fontSize: 10, marginTop: 2, color: '#555' }}>{preset.name}</span>
    </button>
  );
};

const TableStylePicker: React.FC<TableStylePickerProps> = ({ editor, onClose, inline }) => {
  const [currentStyle, setCurrentStyle] = useState('plain');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { $anchor } = editor.state.selection;
      let d = $anchor.depth;
      while (d > 0) {
        const n = $anchor.node(d);
        if (n.type.name === 'table') {
          setCurrentStyle(n.attrs.tableStyle || 'plain');
          break;
        }
        d--;
      }
    };
    editor.on('selectionUpdate', update);
    update();
    return () => { editor.off('selectionUpdate', update); };
  }, [editor]);

  // Close on click outside
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handlePick = (preset: TableStylePreset) => {
    applyTableStyle(editor, preset);
    setCurrentStyle(preset.id);
    onClose?.();
  };

  return (
    <div
      ref={ref}
      className="table-style-picker"
      style={{
        ...(inline ? {} : { position: 'absolute', zIndex: 100 }),
        background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: 8, display: 'flex', flexWrap: 'wrap', maxWidth: 300,
      }}
    >
      {TABLE_STYLE_PRESETS.map((p) => (
        <StyleThumbnail key={p.id} preset={p} selected={p.id === currentStyle} onClick={() => handlePick(p)} />
      ))}
    </div>
  );
};

export default TableStylePicker;
