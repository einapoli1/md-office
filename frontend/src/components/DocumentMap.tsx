import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { X } from 'lucide-react';

interface DocumentMapProps {
  editor: any;
  onClose: () => void;
}

const MAP_WIDTH = 120;

const DocumentMap: React.FC<DocumentMapProps> = ({ editor, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(50);
  const [mapHeight, setMapHeight] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const scaleRef = useRef(1);

  const renderMinimap = useCallback(() => {
    if (!editor || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get editor DOM
    const editorEl = editor.view.dom as HTMLElement;
    const scrollContainer = editorEl.closest('.main-editor') || editorEl.parentElement?.parentElement?.parentElement;
    if (!scrollContainer) return;

    const docHeight = editorEl.scrollHeight;
    const containerHeight = containerRef.current?.clientHeight || 400;
    const scale = Math.min(containerHeight / docHeight, 1);
    scaleRef.current = scale;

    const renderH = Math.min(docHeight * scale, containerHeight);
    setMapHeight(renderH);

    canvas.width = MAP_WIDTH * 2; // retina
    canvas.height = renderH * 2;
    canvas.style.width = `${MAP_WIDTH}px`;
    canvas.style.height = `${renderH}px`;
    ctx.scale(2, 2);

    // Clear
    ctx.fillStyle = 'var(--bg-primary, #fafafa)';
    ctx.fillRect(0, 0, MAP_WIDTH, renderH);

    // Render text lines as thin bars
    const { doc } = editor.state;
    let y = 0;
    const lineH = Math.max(2, 3 * scale);
    const gap = Math.max(1, 2 * scale);

    doc.descendants((node: any, _pos: number) => {
      if (node.isBlock && node.textContent) {
        const text = node.textContent;
        const width = Math.min(MAP_WIDTH - 16, (text.length / 80) * (MAP_WIDTH - 16));

        if (node.type.name === 'heading') {
          const level = node.attrs?.level || 1;
          ctx.fillStyle = level === 1 ? '#4285f4' : level === 2 ? '#0f9d58' : '#f4a024';
          ctx.fillRect(8, y, Math.max(width, 30), lineH + 1);
        } else {
          ctx.fillStyle = '#ccc';
          ctx.fillRect(8, y, width || 20, lineH);
        }

        y += lineH + gap;
      }
    });

    // Viewport indicator
    const scrollTop = scrollContainer.scrollTop || 0;
    const clientH = scrollContainer.clientHeight || 300;
    const totalH = scrollContainer.scrollHeight || docHeight;

    const vpTop = (scrollTop / totalH) * renderH;
    const vpH = Math.max(20, (clientH / totalH) * renderH);
    setViewportTop(vpTop);
    setViewportHeight(vpH);
  }, [editor]);

  useEffect(() => {
    renderMinimap();

    const editorEl = editor?.view?.dom as HTMLElement | undefined;
    const scrollContainer = editorEl?.closest('.main-editor') || editorEl?.parentElement?.parentElement?.parentElement;

    const handleScroll = () => renderMinimap();
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });

    if (editor) {
      const txHandler = () => setTimeout(renderMinimap, 50);
      editor.on('transaction', txHandler);
      return () => {
        editor.off('transaction', txHandler);
        scrollContainer?.removeEventListener('scroll', handleScroll);
      };
    }

    return () => { scrollContainer?.removeEventListener('scroll', handleScroll); };
  }, [editor, renderMinimap]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => renderMinimap());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [renderMinimap]);

  const navigateTo = (clientY: number) => {
    if (!editor || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relY = clientY - rect.top;
    const fraction = relY / mapHeight;

    const editorEl = editor.view.dom as HTMLElement;
    const scrollContainer = editorEl.closest('.main-editor') || editorEl.parentElement?.parentElement?.parentElement;
    if (scrollContainer) {
      const scrollTarget = fraction * scrollContainer.scrollHeight;
      scrollContainer.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    navigateTo(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => navigateTo(e.clientY);
    const handleUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, mapHeight]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        right: 0,
        top: 80,
        bottom: 30,
        width: MAP_WIDTH + 16,
        background: 'var(--bg-primary, #fafafa)',
        borderLeft: '1px solid var(--border-color, #e0e0e0)',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border-color, #eee)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#888' }}>Map</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={12} /></button>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onMouseDown={handleMouseDown}>
        <canvas ref={canvasRef} />
        {/* Viewport highlight */}
        <div style={{
          position: 'absolute',
          top: viewportTop,
          left: 0,
          right: 0,
          height: viewportHeight,
          background: 'rgba(66, 133, 244, 0.15)',
          border: '1px solid rgba(66, 133, 244, 0.4)',
          borderRadius: 2,
          pointerEvents: 'none',
          transition: isDragging ? 'none' : 'top 0.1s ease',
        }} />
      </div>
    </div>
  );
};

export default memo(DocumentMap);
