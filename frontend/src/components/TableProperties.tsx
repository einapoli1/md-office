import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface TablePropertiesProps {
  editor: any;
  onClose: () => void;
  initialTab?: 'table' | 'row' | 'cell';
}

const TABS = ['table', 'row', 'cell'] as const;

const TableProperties: React.FC<TablePropertiesProps> = ({ editor, onClose, initialTab = 'table' }) => {
  const [tab, setTab] = useState<'table' | 'row' | 'cell'>(initialTab);

  // ── Table tab state ──
  const [tableWidth, setTableWidth] = useState('100%');
  const [tableAlign, setTableAlign] = useState('left');
  const [cellMargins, setCellMargins] = useState('4px');
  const [cellSpacing, setCellSpacing] = useState('0px');

  // ── Row tab state ──
  const [rowHeight, setRowHeight] = useState('auto');
  const [headerRepeat, setHeaderRepeat] = useState(false);
  const [allowBreak, setAllowBreak] = useState(true);

  // ── Cell tab state ──
  const [cellWidth, setCellWidth] = useState('');
  const [cellVAlign, setCellVAlign] = useState('top');
  const [cellBg, setCellBg] = useState('');
  const [cellBorderColor, setCellBorderColor] = useState('#000');
  const [cellBorderWidth, setCellBorderWidth] = useState('1px');
  const [cellBorderStyle, setCellBorderStyle] = useState('solid');
  const [cellPadding, setCellPadding] = useState('');
  const [applyTo, setApplyTo] = useState<'selected' | 'row' | 'column' | 'table'>('selected');

  // Read current attrs
  useEffect(() => {
    if (!editor) return;
    const { $anchor } = editor.state.selection;
    let d = $anchor.depth;
    while (d > 0) {
      const n = $anchor.node(d);
      if (n.type.name === 'table') {
        setTableAlign(n.attrs.tableAlignment || 'left');
        break;
      }
      if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') {
        setCellVAlign(n.attrs.verticalAlign || 'top');
        setCellBg(n.attrs.backgroundColor || '');
        setCellBorderColor(n.attrs.borderColor || '#000');
        setCellBorderWidth(n.attrs.borderWidth || '1px');
        setCellBorderStyle(n.attrs.borderStyle || 'solid');
        setCellPadding(n.attrs.cellPadding || '');
      }
      d--;
    }
  }, [editor]);

  const applyCellAttrs = useCallback(() => {
    if (!editor) return;

    const attrs: Record<string, any> = {
      verticalAlign: cellVAlign,
      backgroundColor: cellBg || null,
      borderColor: cellBorderColor,
      borderWidth: cellBorderWidth,
      borderStyle: cellBorderStyle,
      cellPadding: cellPadding || null,
    };

    if (applyTo === 'selected') {
      // Apply to current cell
      editor.chain().focus().updateAttributes('tableCell', attrs).updateAttributes('tableHeader', attrs).run();
    } else {
      // For row/column/table, walk the document
      const { state } = editor;
      const { $anchor } = state.selection;
      const { tr } = state;

      let tablePos = -1;
      let tableNode: any = null;
      let currentRow = -1;
      let currentCol = -1;
      let depth = $anchor.depth;

      while (depth > 0) {
        const n = $anchor.node(depth);
        if (n.type.name === 'table') {
          tableNode = n;
          tablePos = $anchor.before(depth);
          break;
        }
        depth--;
      }
      if (!tableNode || tablePos < 0) return;

      // Find current row/col
      let rowIdx = 0;
      tableNode.forEach((row: any, rowOffset: number) => {
        let colIdx = 0;
        row.forEach((_cell: any, cellOffset: number) => {
          const cPos = tablePos + 1 + rowOffset + 1 + cellOffset;
          if (cPos === $anchor.before($anchor.depth)) {
            currentRow = rowIdx;
            currentCol = colIdx;
          }
          colIdx++;
        });
        rowIdx++;
      });

      rowIdx = 0;
      tableNode.forEach((row: any, rowOffset: number) => {
        let colIdx = 0;
        row.forEach((cell: any, cellOffset: number) => {
          const cPos = tablePos + 1 + rowOffset + 1 + cellOffset;
          let shouldApply = false;
          if (applyTo === 'table') shouldApply = true;
          else if (applyTo === 'row' && rowIdx === currentRow) shouldApply = true;
          else if (applyTo === 'column' && colIdx === currentCol) shouldApply = true;

          if (shouldApply) {
            tr.setNodeMarkup(cPos, undefined, { ...cell.attrs, ...attrs });
          }
          colIdx++;
        });
        rowIdx++;
      });

      editor.view.dispatch(tr);
    }
  }, [editor, cellVAlign, cellBg, cellBorderColor, cellBorderWidth, cellBorderStyle, cellPadding, applyTo]);

  const applyTableAttrs = useCallback(() => {
    if (!editor) return;
    const { state } = editor;
    const { $anchor } = state.selection;
    let depth = $anchor.depth;
    while (depth > 0) {
      const n = $anchor.node(depth);
      if (n.type.name === 'table') {
        const pos = $anchor.before(depth);
        const { tr } = state;
        tr.setNodeMarkup(pos, undefined, {
          ...n.attrs,
          tableAlignment: tableAlign,
        });
        editor.view.dispatch(tr);
        break;
      }
      depth--;
    }
  }, [editor, tableAlign, tableWidth, cellMargins, cellSpacing]);

  const handleApply = () => {
    if (tab === 'table') applyTableAttrs();
    else if (tab === 'cell') applyCellAttrs();
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, width: '100%',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#555', marginBottom: 2, display: 'block' };
  const rowStyle: React.CSSProperties = { marginBottom: 8 };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        width: 420, maxHeight: '80vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Table Properties</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400,
                background: tab === t ? '#f3f4f6' : 'transparent',
                borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          {tab === 'table' && (
            <>
              <div style={rowStyle}>
                <label style={labelStyle}>Table Width</label>
                <input style={inputStyle} value={tableWidth} onChange={(e) => setTableWidth(e.target.value)} placeholder="e.g. 100%, 500px" />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Alignment</label>
                <select style={inputStyle} value={tableAlign} onChange={(e) => setTableAlign(e.target.value)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Default Cell Margins</label>
                <input style={inputStyle} value={cellMargins} onChange={(e) => setCellMargins(e.target.value)} placeholder="e.g. 4px" />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Cell Spacing</label>
                <input style={inputStyle} value={cellSpacing} onChange={(e) => setCellSpacing(e.target.value)} placeholder="e.g. 0px" />
              </div>
            </>
          )}

          {tab === 'row' && (
            <>
              <div style={rowStyle}>
                <label style={labelStyle}>Row Height</label>
                <input style={inputStyle} value={rowHeight} onChange={(e) => setRowHeight(e.target.value)} placeholder="auto or e.g. 40px" />
              </div>
              <div style={rowStyle}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={headerRepeat} onChange={(e) => setHeaderRepeat(e.target.checked)} />
                  Repeat as header row on each page
                </label>
              </div>
              <div style={rowStyle}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={allowBreak} onChange={(e) => setAllowBreak(e.target.checked)} />
                  Allow row to break across pages
                </label>
              </div>
            </>
          )}

          {tab === 'cell' && (
            <>
              <div style={rowStyle}>
                <label style={labelStyle}>Cell Width</label>
                <input style={inputStyle} value={cellWidth} onChange={(e) => setCellWidth(e.target.value)} placeholder="auto or e.g. 150px" />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Vertical Alignment</label>
                <select style={inputStyle} value={cellVAlign} onChange={(e) => setCellVAlign(e.target.value)}>
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Background Color</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={cellBg || '#ffffff'} onChange={(e) => setCellBg(e.target.value)} style={{ width: 32, height: 28, border: 'none', padding: 0 }} />
                  <input style={{ ...inputStyle, flex: 1 }} value={cellBg} onChange={(e) => setCellBg(e.target.value)} placeholder="#ffffff" />
                </div>
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Border</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select style={{ ...inputStyle, flex: 1 }} value={cellBorderStyle} onChange={(e) => setCellBorderStyle(e.target.value)}>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="none">None</option>
                  </select>
                  <input style={{ ...inputStyle, width: 60 }} value={cellBorderWidth} onChange={(e) => setCellBorderWidth(e.target.value)} placeholder="1px" />
                  <input type="color" value={cellBorderColor} onChange={(e) => setCellBorderColor(e.target.value)} style={{ width: 32, height: 28, border: 'none', padding: 0 }} />
                </div>
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Cell Padding</label>
                <input style={inputStyle} value={cellPadding} onChange={(e) => setCellPadding(e.target.value)} placeholder="e.g. 8px" />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Apply to</label>
                <select style={inputStyle} value={applyTo} onChange={(e) => setApplyTo(e.target.value as any)}>
                  <option value="selected">Selected cells</option>
                  <option value="row">Entire row</option>
                  <option value="column">Entire column</option>
                  <option value="table">Whole table</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleApply} style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Apply</button>
        </div>
      </div>
    </div>
  );
};

export default TableProperties;
