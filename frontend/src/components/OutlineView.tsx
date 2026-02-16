import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { X, List, Search, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';

interface OutlineItem {
  id: string;
  level: number;
  text: string;
  pos: number;
  endPos: number;
  wordCount: number;
  collapsed: boolean;
}

interface OutlineViewProps {
  editor: any;
  onClose: () => void;
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#4285f4', // blue
  2: '#0f9d58', // green
  3: '#f4a024', // orange
  4: '#db4437', // red
  5: '#ab47bc', // purple
  6: '#00acc1', // teal
};

const OutlineView: React.FC<OutlineViewProps> = ({ editor, onClose }) => {
  const [items, setItems] = useState<OutlineItem[]>([]);
  const [filter, setFilter] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; idx: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scanHeadings = useCallback(() => {
    if (!editor) return;
    const { doc } = editor.state;
    const found: { level: number; text: string; pos: number }[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        found.push({ level: node.attrs.level, text: node.textContent, pos });
      }
    });

    // Calculate end positions and word counts
    const result: OutlineItem[] = found.map((h, i) => {
      const endPos = i + 1 < found.length ? found[i + 1].pos : doc.content.size;
      const text = doc.textBetween(h.pos, endPos, ' ');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const id = `outline-${h.pos}`;
      return {
        id,
        level: h.level,
        text: h.text,
        pos: h.pos,
        endPos,
        wordCount: words,
        collapsed: collapsedIds.has(id),
      };
    });

    setItems(result);
  }, [editor, collapsedIds]);

  useEffect(() => {
    scanHeadings();
    if (editor) {
      const handler = () => scanHeadings();
      editor.on('transaction', handler);
      return () => { editor.off('transaction', handler); };
    }
  }, [editor, scanHeadings]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const scrollTo = (pos: number) => {
    if (!editor) return;
    editor.commands.setTextSelection(pos + 1);
    try {
      const domAtPos = editor.view.domAtPos(pos + 1);
      const el = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => editor.commands.focus(), 300);
        return;
      }
    } catch { /* fallback */ }
    editor.commands.focus();
    editor.commands.scrollIntoView();
  };

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Check if item is hidden because a parent is collapsed
  const isHidden = (idx: number): boolean => {
    for (let i = idx - 1; i >= 0; i--) {
      if (items[i].level < items[idx].level) {
        if (collapsedIds.has(items[i].id)) return true;
        // Check further up
        return isHidden(i);
      }
    }
    return false;
  };

  const hasChildren = (idx: number): boolean => {
    if (idx + 1 >= items.length) return false;
    return items[idx + 1].level > items[idx].level;
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }

    const src = items[dragIdx];
    const dst = items[targetIdx];

    // Find the section ranges
    const srcEnd = src.endPos;
    const srcStart = src.pos;

    // Get the content of the source section
    const { tr } = editor.state;
    const slice = editor.state.doc.slice(srcStart, srcEnd);

    // Determine insert position
    const insertPos = targetIdx > dragIdx ? dst.endPos : dst.pos;

    // Perform the move - delete source first if it's before target
    if (dragIdx < targetIdx) {
      tr.insert(insertPos, slice.content);
      tr.delete(srcStart, srcEnd);
    } else {
      tr.delete(srcStart, srcEnd);
      tr.insert(Math.min(insertPos, tr.doc.content.size), slice.content);
    }

    editor.view.dispatch(tr);
    setDragIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Context menu actions
  const promoteHeading = (idx: number) => {
    const item = items[idx];
    if (item.level <= 1) return;
    const { tr } = editor.state;
    const node = tr.doc.nodeAt(item.pos);
    if (node) {
      tr.setNodeMarkup(item.pos, undefined, { ...node.attrs, level: item.level - 1 });
      editor.view.dispatch(tr);
    }
  };

  const demoteHeading = (idx: number) => {
    const item = items[idx];
    if (item.level >= 6) return;
    const { tr } = editor.state;
    const node = tr.doc.nodeAt(item.pos);
    if (node) {
      tr.setNodeMarkup(item.pos, undefined, { ...node.attrs, level: item.level + 1 });
      editor.view.dispatch(tr);
    }
  };

  const deleteSection = (idx: number) => {
    const item = items[idx];
    const { tr } = editor.state;
    tr.delete(item.pos, item.endPos);
    editor.view.dispatch(tr);
  };

  const duplicateSection = (idx: number) => {
    const item = items[idx];
    const slice = editor.state.doc.slice(item.pos, item.endPos);
    const { tr } = editor.state;
    tr.insert(item.endPos, slice.content);
    editor.view.dispatch(tr);
  };

  const handleContextMenu = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, idx });
  };

  const filtered = items.filter((item, idx) => {
    if (isHidden(idx)) return false;
    if (filter && !item.text.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="toc-sidebar" ref={containerRef}>
      <div className="toc-header">
        <div className="toc-title">
          <List size={16} />
          <span>Outline</span>
        </div>
        <button className="toc-close-btn" onClick={onClose}><X size={16} /></button>
      </div>

      <div style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary, #f5f5f5)', borderRadius: 4, padding: '2px 6px' }}>
          <Search size={14} style={{ opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Filter headings..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: '100%', padding: '4px 0' }}
          />
        </div>
      </div>

      <div className="toc-list" style={{ overflow: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div className="toc-empty">
            <p>No headings found</p>
            <p className="toc-empty-hint">Add headings to create an outline</p>
          </div>
        ) : (
          filtered.map((item) => {
            const idx = items.indexOf(item);
            const color = LEVEL_COLORS[item.level] || '#666';
            const isCollapsed = collapsedIds.has(item.id);
            const showChevron = hasChildren(idx);

            return (
              <div
                key={item.id}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onContextMenu={e => handleContextMenu(e, idx)}
                className={`toc-item toc-level-${item.level}`}
                onClick={() => scrollTo(item.pos)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  borderLeft: `3px solid ${color}`,
                  background: dragOverIdx === idx ? 'var(--bg-hover, #e3f2fd)' : undefined,
                  opacity: dragIdx === idx ? 0.4 : 1,
                  cursor: 'pointer',
                  paddingLeft: `${(item.level - 1) * 16 + 4}px`,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  fontSize: 13,
                  transition: 'background 0.15s',
                }}
              >
                <GripVertical size={12} style={{ opacity: 0.3, cursor: 'grab', flexShrink: 0 }} />
                {showChevron ? (
                  <span onClick={e => toggleCollapse(item.id, e)} style={{ flexShrink: 0, display: 'flex' }}>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>
                ) : (
                  <span style={{ width: 14, flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color }}>
                  {item.text || '(empty heading)'}
                </span>
                <span style={{ fontSize: 10, color: '#999', flexShrink: 0 }}>{item.wordCount}w</span>
              </div>
            );
          })
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-primary, white)',
            border: '1px solid var(--border-color, #ddd)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10000,
            padding: '4px 0',
            minWidth: 180,
            fontSize: 13,
          }}
          onClick={() => setContextMenu(null)}
        >
          {items[contextMenu.idx]?.level > 1 && (
            <div style={ctxItemStyle} onClick={() => promoteHeading(contextMenu.idx)}>
              ⬆ Promote (H{items[contextMenu.idx].level} → H{items[contextMenu.idx].level - 1})
            </div>
          )}
          {items[contextMenu.idx]?.level < 6 && (
            <div style={ctxItemStyle} onClick={() => demoteHeading(contextMenu.idx)}>
              ⬇ Demote (H{items[contextMenu.idx].level} → H{items[contextMenu.idx].level + 1})
            </div>
          )}
          <div style={{ height: 1, background: 'var(--border-color, #eee)', margin: '4px 0' }} />
          <div style={ctxItemStyle} onClick={() => duplicateSection(contextMenu.idx)}>📋 Duplicate section</div>
          <div style={{ ...ctxItemStyle, color: '#d32f2f' }} onClick={() => deleteSection(contextMenu.idx)}>🗑 Delete section</div>
        </div>
      )}
    </div>
  );
};

const ctxItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  transition: 'background 0.1s',
};

export default memo(OutlineView);
