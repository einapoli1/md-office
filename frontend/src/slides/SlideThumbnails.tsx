import { useState, useRef, useCallback } from 'react';
import { Slide } from './slideModel';
import { SlideTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';

interface Props {
  slides: Slide[];
  activeIndex: number;
  theme: SlideTheme;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onAddSlide: (atIndex: number) => void;
  onDuplicateSlide: (index: number) => void;
  onDeleteSlide: (index: number) => void;
}

export default function SlideThumbnails({ slides, activeIndex, theme, onSelect, onReorder, onAddSlide, onDuplicateSlide, onDeleteSlide }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; idx: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), []);
  const handleDragOver = useCallback((e: React.DragEvent, _idx: number) => { e.preventDefault(); }, []);
  const handleDrop = useCallback((idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) onReorder(dragIdx, idx);
    setDragIdx(null);
  }, [dragIdx, onReorder]);

  const handleContextMenu = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, idx });
  };

  return (
    <div className="slide-thumbnails" ref={listRef} onClick={() => setCtxMenu(null)}>
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          className={`slide-thumb ${i === activeIndex ? 'active' : ''} ${dragIdx === i ? 'dragging' : ''}`}
          onClick={() => onSelect(i)}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={() => handleDrop(i)}
          onContextMenu={(e) => handleContextMenu(e, i)}
        >
          <span className="thumb-number">{i + 1}</span>
          <div className="thumb-preview">
            <SlideCanvas slide={slide} theme={theme} scale={0.12} />
          </div>
        </div>
      ))}
      <button className="thumb-add-btn" onClick={() => onAddSlide(slides.length)} title="Add slide">+</button>

      {ctxMenu && (
        <div className="thumb-context-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { onAddSlide(ctxMenu.idx); setCtxMenu(null); }}>Add slide above</button>
          <button onClick={() => { onAddSlide(ctxMenu.idx + 1); setCtxMenu(null); }}>Add slide below</button>
          <button onClick={() => { onDuplicateSlide(ctxMenu.idx); setCtxMenu(null); }}>Duplicate</button>
          {slides.length > 1 && (
            <button onClick={() => { onDeleteSlide(ctxMenu.idx); setCtxMenu(null); }}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}
