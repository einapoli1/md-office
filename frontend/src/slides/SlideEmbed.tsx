import { useState, useRef, useCallback, useEffect } from 'react';
import { embedRegistry } from '../lib/embedRegistry';
import { embedSync } from '../lib/embedSync';

interface SlideEmbedProps {
  embedId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected?: boolean;
  onMove?: (x: number, y: number) => void;
  onResize?: (width: number, height: number) => void;
  onRemove?: () => void;
}

export default function SlideEmbed({
  embedId, x, y, width, height, selected,
  onMove, onResize, onRemove,
}: SlideEmbedProps) {
  const [entry, setEntry] = useState(() => embedRegistry.get(embedId));
  const [stale, setStale] = useState(() => embedSync.isStale(embedId));
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  useEffect(() => {
    const unsub1 = embedRegistry.subscribe(() => setEntry(embedRegistry.get(embedId)));
    const unsub2 = embedSync.subscribe(() => setStale(embedSync.isStale(embedId)));
    return () => { unsub1(); unsub2(); };
  }, [embedId]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onMove?.(dragRef.current.origX + dx, dragRef.current.origY + dy);
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [x, y, onMove]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: width, origH: height };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      onResize?.(Math.max(100, resizeRef.current.origW + dw), Math.max(60, resizeRef.current.origH + dh));
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [width, height, onResize]);

  const snapshot = entry?.snapshot || '<div style="padding:20px;color:#999;text-align:center">No preview</div>';
  const sourceName = entry?.sourceFile?.split('/').pop()?.replace('.sheet.md', '') || 'Sheet';

  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width, height,
        border: selected ? '2px solid #4285f4' : '1px solid #ccc',
        borderRadius: 4, overflow: 'hidden', background: 'white',
        cursor: 'move', boxSizing: 'border-box',
      }}
      onMouseDown={handleMouseDown}
    >
      {stale && (
        <div style={{
          position: 'absolute', top: 2, right: 2, zIndex: 2,
          background: '#fbbf24', color: '#78350f', fontSize: 10,
          padding: '1px 6px', borderRadius: 8, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          ⚠ Outdated
          <button
            onClick={(e) => { e.stopPropagation(); embedSync.clearStale(embedId); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, textDecoration: 'underline', color: '#78350f' }}
          >↻</button>
        </div>
      )}
      <div
        style={{ width: '100%', height: 'calc(100% - 22px)', overflow: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: snapshot }}
      />
      <div style={{
        height: 22, fontSize: 10, color: '#888', padding: '2px 6px',
        borderTop: '1px solid #eee', background: '#fafafa',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        Linked from <strong>{sourceName}</strong>
      </div>

      {selected && (
        <>
          {/* Resize handle */}
          <div
            onMouseDown={handleResizeMouseDown}
            style={{
              position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
              cursor: 'nwse-resize', background: '#4285f4', borderRadius: '2px 0 4px 0',
            }}
          />
          {/* Remove button */}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              style={{
                position: 'absolute', top: -8, right: -8,
                width: 18, height: 18, borderRadius: '50%', border: 'none',
                background: '#ef4444', color: 'white', fontSize: 11,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          )}
        </>
      )}
    </div>
  );
}
