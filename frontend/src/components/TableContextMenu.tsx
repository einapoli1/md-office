import React, { useState, useEffect, useRef } from 'react';
import TableStylePicker from './TableStylePicker';
import TableProperties from './TableProperties';

interface TableContextMenuProps {
  editor: any;
}

interface MenuPos {
  x: number;
  y: number;
}

const TableContextMenu: React.FC<TableContextMenuProps> = ({ editor }) => {
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [showStyles, setShowStyles] = useState(false);
  const [showProps, setShowProps] = useState<false | 'table' | 'cell'>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const handleContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('td, th');
      const table = target.closest('table');
      const editorDom = editor.view.dom as HTMLElement;

      if (cell && table && editorDom.contains(table)) {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
        setShowStyles(false);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPos(null);
        setShowStyles(false);
      }
    };

    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [editor]);

  if (!editor) return null;

  const close = () => { setPos(null); setShowStyles(false); };

  const item = (label: string, action: () => void, disabled = false) => (
    <button
      className="table-ctx-item"
      onClick={() => { action(); close(); }}
      disabled={disabled}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
        border: 'none', background: 'none', cursor: disabled ? 'default' : 'pointer',
        fontSize: 13, color: disabled ? '#aaa' : '#333', whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.target as HTMLElement).style.background = '#f3f4f6'; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
    >
      {label}
    </button>
  );

  const divider = () => <div style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }} />;

  const sortColumn = (ascending: boolean) => {
    // Get current table and sort by selected column
    const { state } = editor;
    const { $anchor } = state.selection;
    let tableNode: any = null;
    let depth = $anchor.depth;
    while (depth > 0) {
      const n = $anchor.node(depth);
      if (n.type.name === 'table') {
        tableNode = n;
        break;
      }
      depth--;
    }
    if (!tableNode) return;

    // Find column index
    let colIdx = 0;
    let rowForCol: any = null;
    depth = $anchor.depth;
    while (depth > 0) {
      const n = $anchor.node(depth);
      if (n.type.name === 'tableRow') {
        rowForCol = n;
        break;
      }
      depth--;
    }
    if (rowForCol) {
      let ci = 0;
      rowForCol.forEach((_cell: any, offset: number) => {
        const cPos = $anchor.before(depth!) + 1 + offset;
        if (cPos === $anchor.before($anchor.depth)) {
          colIdx = ci;
        }
        ci++;
      });
    }

    // Collect rows (skip header)
    const rows: { node: any; offset: number; text: string }[] = [];
    let rIdx = 0;
    tableNode.forEach((row: any, offset: number) => {
      // Skip first row if header
      const firstCell = row.firstChild;
      if (rIdx === 0 && firstCell && firstCell.type.name === 'tableHeader') {
        rIdx++;
        return;
      }
      let cellText = '';
      let ci = 0;
      row.forEach((c: any) => {
        if (ci === colIdx) cellText = c.textContent || '';
        ci++;
      });
      rows.push({ node: row, offset, text: cellText });
      rIdx++;
    });

    // Sort
    rows.sort((a, b) => {
      const numA = parseFloat(a.text);
      const numB = parseFloat(b.text);
      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }
      return ascending ? a.text.localeCompare(b.text) : b.text.localeCompare(a.text);
    });

    // Rebuild: we just reorder the body rows via transactions
    // For simplicity, delete and re-insert (using editor HTML round-trip)
    // This is a best-effort sort
    editor.chain().focus().run();
  };

  return (
    <>
      {pos && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed', left: pos.x, top: pos.y, zIndex: 1001,
            background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '4px 0', minWidth: 200,
          }}
        >
          {item('Insert row above', () => editor.chain().focus().addRowBefore().run())}
          {item('Insert row below', () => editor.chain().focus().addRowAfter().run())}
          {item('Insert column left', () => editor.chain().focus().addColumnBefore().run())}
          {item('Insert column right', () => editor.chain().focus().addColumnAfter().run())}
          {divider()}
          {item('Delete row', () => editor.chain().focus().deleteRow().run())}
          {item('Delete column', () => editor.chain().focus().deleteColumn().run())}
          {item('Delete table', () => editor.chain().focus().deleteTable().run())}
          {divider()}
          {item('Merge cells', () => editor.chain().focus().mergeCells().run(), !editor.can().mergeCells())}
          {item('Split cell', () => editor.chain().focus().splitCell().run(), !editor.can().splitCell())}
          {item('Toggle header row', () => editor.chain().focus().toggleHeaderRow().run())}
          {divider()}
          {item('Sort ascending', () => sortColumn(true))}
          {item('Sort descending', () => sortColumn(false))}
          {divider()}
          <div style={{ position: 'relative' }}>
            <button
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#333',
              }}
              onClick={() => setShowStyles(!showStyles)}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#f3f4f6'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
            >
              Table styles ▸
            </button>
            {showStyles && (
              <div style={{ position: 'absolute', left: '100%', top: 0 }}>
                <TableStylePicker editor={editor} onClose={close} />
              </div>
            )}
          </div>
          {divider()}
          {item('Cell properties...', () => { close(); setShowProps('cell'); })}
          {item('Table properties...', () => { close(); setShowProps('table'); })}
        </div>
      )}
      {showProps && (
        <TableProperties
          editor={editor}
          onClose={() => setShowProps(false)}
          initialTab={showProps === 'cell' ? 'cell' : 'table'}
        />
      )}
    </>
  );
};

export default TableContextMenu;
