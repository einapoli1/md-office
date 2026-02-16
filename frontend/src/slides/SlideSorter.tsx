import { useState, useCallback, useRef } from 'react';
import { Slide } from './slideModel';
import { SlideTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';

interface Section {
  name: string;
  startIndex: number;
}

interface Props {
  slides: Slide[];
  theme: SlideTheme;
  activeIndex: number;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}

export default function SlideSorter({
  slides, theme, activeIndex, onSelect, onReorder, onDuplicate, onDelete, onClose,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set([activeIndex]));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [hiddenSlides, setHiddenSlides] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback((index: number, e: React.MouseEvent) => {
    if (e.shiftKey && selected.size > 0) {
      const arr = Array.from(selected);
      const last = arr[arr.length - 1];
      const from = Math.min(last, index);
      const to = Math.max(last, index);
      const newSet = new Set(selected);
      for (let i = from; i <= to; i++) newSet.add(i);
      setSelected(newSet);
    } else if (e.metaKey || e.ctrlKey) {
      const newSet = new Set(selected);
      if (newSet.has(index)) newSet.delete(index); else newSet.add(index);
      setSelected(newSet);
    } else {
      setSelected(new Set([index]));
      onSelect(index);
    }
    setContextMenu(null);
  }, [selected, onSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index });
    if (!selected.has(index)) setSelected(new Set([index]));
  }, [selected]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIdx(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== toIndex) {
      onReorder(dragIdx, toIndex);
    }
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  const toggleHide = useCallback((index: number) => {
    setHiddenSlides(prev => {
      const n = new Set(prev);
      if (n.has(index)) n.delete(index); else n.add(index);
      return n;
    });
  }, []);

  const addSection = useCallback((index: number) => {
    setSections(prev => [...prev, { name: 'New Section', startIndex: index }].sort((a, b) => a.startIndex - b.startIndex));
    setContextMenu(null);
  }, []);

  const getSectionForSlide = (index: number): Section | undefined => {
    let current: Section | undefined;
    for (const s of sections) {
      if (s.startIndex <= index) current = s;
    }
    return current;
  };

  const bulkDelete = useCallback(() => {
    const sorted = Array.from(selected).sort((a, b) => b - a);
    sorted.forEach(i => onDelete(i));
    setSelected(new Set());
    setContextMenu(null);
  }, [selected, onDelete]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary, #f0f0f0)', zIndex: 999,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', borderBottom: '1px solid var(--border-color, #ddd)',
        background: 'var(--bg-secondary, #fff)',
      }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>📊 Slide Sorter</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#666', alignSelf: 'center' }}>
            {selected.size} selected · {slides.length} slides
          </span>
          <button onClick={onClose} style={{
            padding: '6px 16px', borderRadius: 6, background: '#4285f4',
            color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            Done
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflow: 'auto', padding: 20,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16, alignContent: 'start',
      }}>
        {slides.map((slide, i) => {
          const section = getSectionForSlide(i);
          const isSectionStart = sections.some(s => s.startIndex === i);
          const isHidden = hiddenSlides.has(i);
          const isSelected = selected.has(i);
          const isDragTarget = dropIdx === i;

          return (
            <div key={slide.id}>
              {/* Section header */}
              {isSectionStart && (
                <div
                  style={{
                    marginBottom: 8, padding: '4px 8px', background: '#f4b400', borderRadius: 4,
                    fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
                  }}
                  onClick={() => {
                    const idx = sections.findIndex(s => s.startIndex === i);
                    setEditingSection(idx);
                    setTimeout(() => sectionInputRef.current?.focus(), 50);
                  }}
                >
                  {editingSection !== null && sections[editingSection]?.startIndex === i ? (
                    <input
                      ref={sectionInputRef}
                      value={section?.name || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setSections(prev => prev.map((s, si) => si === editingSection ? { ...s, name: val } : s));
                      }}
                      onBlur={() => setEditingSection(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingSection(null); }}
                      style={{
                        background: 'transparent', border: 'none', color: '#fff',
                        fontWeight: 600, fontSize: 12, width: '100%', outline: 'none',
                      }}
                    />
                  ) : (
                    `📁 ${section?.name}`
                  )}
                </div>
              )}

              {/* Slide thumbnail */}
              <div
                draggable
                onClick={e => handleClick(i, e)}
                onContextMenu={e => handleContextMenu(e, i)}
                onDragStart={e => handleDragStart(e, i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={e => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                style={{
                  border: isSelected ? '3px solid #4285f4' : isDragTarget ? '3px dashed #f4b400' : '2px solid var(--border-color, #ddd)',
                  borderRadius: 8, overflow: 'hidden', cursor: 'grab',
                  opacity: isHidden ? 0.4 : dragIdx === i ? 0.5 : 1,
                  background: 'var(--bg-secondary, #fff)',
                  transition: 'border-color 0.15s, opacity 0.15s',
                }}
              >
                <div style={{ pointerEvents: 'none', transform: 'scale(0.25)', transformOrigin: 'top left', width: 400, height: 225 }}>
                  <div style={{ width: 960, height: 540 }}>
                    <SlideCanvas slide={slide} theme={theme} editable={false} onContentChange={() => {}} />
                  </div>
                </div>
                <div style={{
                  padding: '6px 8px', fontSize: 12, display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                  borderTop: '1px solid var(--border-color, #ddd)',
                }}>
                  <span style={{ fontWeight: 600 }}>
                    {isHidden && '👁‍🗨 '}{i + 1}
                  </span>
                  {slide.transition !== 'none' && (
                    <span title={`Transition: ${slide.transition}`} style={{ fontSize: 10, color: '#888' }}>
                      ✨ {slide.transition}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: 'var(--bg-secondary, #fff)', border: '1px solid var(--border-color, #ddd)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 1001,
            minWidth: 180, padding: '4px 0',
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {[
            { label: '📋 Duplicate', action: () => { onDuplicate(contextMenu.index); setContextMenu(null); } },
            { label: '🗑 Delete', action: bulkDelete },
            { label: hiddenSlides.has(contextMenu.index) ? '👁 Unhide' : '👁‍🗨 Hide', action: () => { toggleHide(contextMenu.index); setContextMenu(null); } },
            { label: 'divider' },
            { label: '⬆ Move to beginning', action: () => { onReorder(contextMenu.index, 0); setContextMenu(null); } },
            { label: '⬇ Move to end', action: () => { onReorder(contextMenu.index, slides.length - 1); setContextMenu(null); } },
            { label: 'divider' },
            { label: '📁 Add section here', action: () => addSection(contextMenu.index) },
          ].map((item, idx) =>
            item.label === 'divider' ? (
              <div key={idx} style={{ height: 1, background: 'var(--border-color, #ddd)', margin: '4px 0' }} />
            ) : (
              <button
                key={idx}
                onClick={item.action}
                style={{
                  display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
