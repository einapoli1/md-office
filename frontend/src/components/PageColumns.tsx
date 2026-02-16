import React, { useState } from 'react';
import { X, Columns as ColumnsIcon } from 'lucide-react';

interface ColumnLayout {
  id: string;
  label: string;
  columns: number;
  widths?: string; // CSS column widths hint (for display only; CSS columns are equal)
  preview: string; // ASCII art preview
}

const LAYOUTS: ColumnLayout[] = [
  { id: 'one', label: 'Single column', columns: 1, preview: '█████' },
  { id: 'two-equal', label: '2 columns (equal)', columns: 2, preview: '██ ██' },
  { id: 'two-wide-left', label: '2 columns (wide left)', columns: 2, widths: '2fr 1fr', preview: '███ █' },
  { id: 'two-wide-right', label: '2 columns (wide right)', columns: 2, widths: '1fr 2fr', preview: '█ ███' },
  { id: 'three-equal', label: '3 columns (equal)', columns: 3, preview: '█ █ █' },
];

interface PageColumnsProps {
  editor: any;
  onClose: () => void;
}

const PageColumns: React.FC<PageColumnsProps> = ({ editor, onClose }) => {
  const [ruleColor, setRuleColor] = useState('#cccccc');
  const [ruleWidth, setRuleWidth] = useState(1);
  const [showRule, setShowRule] = useState(false);

  const applyLayout = (layout: ColumnLayout) => {
    if (!editor) return;
    const el = editor.view.dom as HTMLElement;

    // Reset
    el.style.columnCount = '';
    el.style.columnGap = '';
    el.style.columnRule = '';
    el.classList.remove('columns-2', 'columns-3', 'col-wide-left', 'col-wide-right');

    if (layout.columns <= 1) {
      editor.commands.setColumns(1);
    } else {
      editor.commands.setColumns(layout.columns);
      if (layout.id === 'two-wide-left') {
        el.classList.add('col-wide-left');
      } else if (layout.id === 'two-wide-right') {
        el.classList.add('col-wide-right');
      }
    }

    if (showRule && layout.columns > 1) {
      el.style.columnRule = `${ruleWidth}px solid ${ruleColor}`;
    }

    onClose();
  };

  const insertColumnBreak = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('<div style="break-before:column"></div>').run();
    onClose();
  };

  const insertSectionBreak = (columns: number) => {
    if (!editor) return;
    editor.chain().focus().insertContent(
      `<div data-section-break data-columns="${columns}" style="break-before:column;column-count:${columns};"></div>`
    ).run();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'white', borderRadius: 8, padding: 24, width: 420,
        maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ColumnsIcon size={20} /> Column Layout
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              onClick={() => applyLayout(layout)}
              style={{
                padding: '12px 8px', border: '1px solid #ddd', borderRadius: 6,
                cursor: 'pointer', background: '#fafafa', textAlign: 'center',
                fontSize: 11,
              }}
              title={layout.label}
            >
              <div style={{ fontFamily: 'monospace', fontSize: 16, marginBottom: 4, letterSpacing: 2 }}>
                {layout.preview}
              </div>
              <div>{layout.label}</div>
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Column Rules</h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" checked={showRule} onChange={(e) => setShowRule(e.target.checked)} />
            Show vertical line between columns
          </label>
          {showRule && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
              <label>
                Color: <input type="color" value={ruleColor} onChange={(e) => setRuleColor(e.target.value)}
                  style={{ width: 30, height: 24, border: 'none', cursor: 'pointer' }} />
              </label>
              <label>
                Width: <input type="number" value={ruleWidth} onChange={(e) => setRuleWidth(Number(e.target.value))}
                  min={1} max={5} style={{ width: 50 }} /> px
              </label>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Breaks</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={insertColumnBreak} style={{
              padding: '6px 12px', border: '1px solid #ddd', borderRadius: 4,
              cursor: 'pointer', background: '#f5f5f5', fontSize: 12,
            }}>
              Column break
            </button>
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => insertSectionBreak(n)} style={{
                padding: '6px 12px', border: '1px solid #ddd', borderRadius: 4,
                cursor: 'pointer', background: '#f5f5f5', fontSize: 12,
              }}>
                Section → {n} col{n > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageColumns;
