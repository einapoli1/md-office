import { useState, useRef } from 'react';

interface SheetTabsProps {
  sheets: { name: string }[];
  activeSheet: number;
  onSelectSheet: (index: number) => void;
  onAddSheet: () => void;
  onRenameSheet: (index: number, name: string) => void;
  onDeleteSheet: (index: number) => void;
}

export default function SheetTabs({ sheets, activeSheet, onSelectSheet, onAddSheet, onRenameSheet, onDeleteSheet }: SheetTabsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (idx: number) => {
    setEditingIndex(idx);
    setEditName(sheets[idx].name);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (editingIndex !== null && editName.trim()) {
      onRenameSheet(editingIndex, editName.trim());
    }
    setEditingIndex(null);
  };

  const handleContextMenu = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index: idx });
  };

  return (
    <div className="sheet-tabs-bar" onClick={() => setContextMenu(null)}>
      <button className="sheet-tab-add" onClick={onAddSheet} title="Add sheet">+</button>
      {sheets.map((s, i) => (
        <div
          key={i}
          className={`sheet-tab ${i === activeSheet ? 'active' : ''}`}
          onClick={() => onSelectSheet(i)}
          onDoubleClick={() => startRename(i)}
          onContextMenu={e => handleContextMenu(e, i)}
        >
          {editingIndex === i ? (
            <input
              ref={inputRef}
              className="sheet-tab-rename-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingIndex(null);
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span>{s.name}</span>
          )}
        </div>
      ))}
      
      {contextMenu && (
        <div
          className="sheet-tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div onClick={() => startRename(contextMenu.index)}>Rename</div>
          {sheets.length > 1 && (
            <div onClick={() => { onDeleteSheet(contextMenu.index); setContextMenu(null); }}>Delete</div>
          )}
        </div>
      )}
    </div>
  );
}
