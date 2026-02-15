import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Trash2, Columns, Rows, Grid3X3,
} from 'lucide-react';

interface TableToolbarProps {
  editor: any;
}

const TableToolbar: React.FC<TableToolbarProps> = ({ editor }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const isTable = editor.isActive('table');
      setVisible(isTable);

      if (isTable) {
        // Find the table DOM element
        const { $anchor } = editor.state.selection;
        let depth = $anchor.depth;
        while (depth > 0) {
          const node = $anchor.node(depth);
          if (node.type.name === 'table') {
            const dom = editor.view.nodeDOM($anchor.before(depth));
            if (dom && dom instanceof HTMLElement) {
              const tableRect = dom.getBoundingClientRect();
              const editorRect = editor.view.dom.closest('.editor-content-area')?.getBoundingClientRect();
              if (editorRect) {
                setPosition({
                  top: tableRect.top - editorRect.top - 44,
                  left: tableRect.left - editorRect.left + tableRect.width / 2,
                });
              }
            }
            break;
          }
          depth--;
        }
      }
    };

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  if (!editor || !visible) return null;

  const btn = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    disabled = false,
    title?: string
  ) => (
    <button
      className="table-toolbar-btn"
      onClick={(e) => { e.preventDefault(); action(); }}
      disabled={disabled}
      title={title || label}
    >
      {icon}
    </button>
  );

  return (
    <div
      ref={toolbarRef}
      className="table-toolbar"
      style={{ top: position.top, left: position.left }}
    >
      {btn('Add row above', <><Rows size={14} /><ArrowUp size={10} /></>, () => editor.chain().focus().addRowBefore().run(), false, 'Add row above')}
      {btn('Add row below', <><Rows size={14} /><ArrowDown size={10} /></>, () => editor.chain().focus().addRowAfter().run(), false, 'Add row below')}

      <div className="table-toolbar-divider" />

      {btn('Add column left', <><Columns size={14} /><ArrowLeft size={10} /></>, () => editor.chain().focus().addColumnBefore().run(), false, 'Add column left')}
      {btn('Add column right', <><Columns size={14} /><ArrowRight size={10} /></>, () => editor.chain().focus().addColumnAfter().run(), false, 'Add column right')}

      <div className="table-toolbar-divider" />

      {btn('Delete row', <span style={{ fontSize: 11, fontWeight: 600 }}>⊖ Row</span>, () => editor.chain().focus().deleteRow().run(), false, 'Delete row')}
      {btn('Delete column', <span style={{ fontSize: 11, fontWeight: 600 }}>⊖ Col</span>, () => editor.chain().focus().deleteColumn().run(), false, 'Delete column')}
      {btn('Delete table', <Trash2 size={14} />, () => editor.chain().focus().deleteTable().run(), false, 'Delete table')}

      <div className="table-toolbar-divider" />

      {btn('Toggle header row', <Grid3X3 size={14} />, () => editor.chain().focus().toggleHeaderRow().run(), false, 'Toggle header row')}
      {btn('Merge cells', <span style={{ fontSize: 11, fontWeight: 600 }}>⊞</span>, () => editor.chain().focus().mergeCells().run(), !editor.can().mergeCells(), 'Merge cells')}
      {btn('Split cell', <span style={{ fontSize: 11, fontWeight: 600 }}>⊟</span>, () => editor.chain().focus().splitCell().run(), !editor.can().splitCell(), 'Split cell')}
    </div>
  );
};

export default TableToolbar;
