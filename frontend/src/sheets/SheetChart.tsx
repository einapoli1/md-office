import { useRef, useEffect, useState, useCallback } from 'react';
import { ChartConfig, SheetData } from './sheetModel';
import { drawChart } from './chartRenderer';

interface SheetChartProps {
  chart: ChartConfig;
  sheet: SheetData;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function SheetChartOverlay({ chart, sheet, onMove, onResize, onDelete, onEdit }: SheetChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = chart.width;
      canvasRef.current.height = chart.height;
      drawChart(canvasRef.current, chart, sheet);
    }
  }, [chart, sheet]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: chart.x, cy: chart.y };
  }, [chart.x, chart.y]);

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: chart.width, cy: chart.height };
  }, [chart.width, chart.height]);

  useEffect(() => {
    if (!dragging && !resizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (dragging) onMove(chart.id, dragStart.current.cx + dx, dragStart.current.cy + dy);
      if (resizing) onResize(chart.id, Math.max(200, dragStart.current.cx + dx), Math.max(150, dragStart.current.cy + dy));
    };
    const handleUp = () => { setDragging(false); setResizing(false); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging, resizing, chart.id, onMove, onResize]);

  return (
    <div
      className="sheet-chart-overlay"
      style={{ position: 'absolute', left: chart.x, top: chart.y, width: chart.width, height: chart.height, border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', background: '#fff', zIndex: 10, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit?.(chart.id); }}
    >
      <button
        className="sheet-chart-close"
        style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#999', zIndex: 11 }}
        onClick={(e) => { e.stopPropagation(); onDelete(chart.id); }}
        title="Delete chart"
      >✕</button>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <div
        style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, cursor: 'nwse-resize', background: 'linear-gradient(135deg, transparent 50%, #999 50%)' }}
        onMouseDown={handleResizeDown}
      />
    </div>
  );
}

// Legacy simple dialog kept for backward compat — now ChartEditor is preferred
export { default as InsertChartDialog } from './ChartEditor';
