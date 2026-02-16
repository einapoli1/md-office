import { useRef, useEffect, useState, useCallback } from 'react';
import { ChartConfig, ChartType, SheetData } from './sheetModel';
import { expandRange } from './formulaEngine';

const DEFAULT_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01', '#46BDC6', '#7B1FA2', '#C2185B'];

interface SheetChartProps {
  chart: ChartConfig;
  sheet: SheetData;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
}

function getValues(sheet: SheetData, range: string): string[] {
  if (!range) return [];
  const refs = expandRange(range);
  return refs.map(r => {
    const cell = sheet.cells[r];
    if (!cell) return '';
    return cell.computed ?? cell.value;
  });
}

function getNumericValues(sheet: SheetData, range: string): number[] {
  return getValues(sheet, range).map(v => parseFloat(v) || 0);
}

function drawChart(canvas: HTMLCanvasElement, chart: ChartConfig, sheet: SheetData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const colors = chart.colors?.length ? chart.colors : DEFAULT_COLORS;
  const labels = getValues(sheet, chart.labelRange);
  const data = getNumericValues(sheet, chart.dataRange);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  // Title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(chart.title || 'Chart', w / 2, 20);

  if (!data.length) return;

  const pad = { top: 35, right: 20, bottom: 40, left: 50 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const toX = (i: number) => pad.left + (i / (data.length - 1 || 1)) * cw;
  const toY = (v: number) => pad.top + ch - ((v - minVal) / range) * ch;

  // Axes
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.stroke();

  // Grid lines & y-axis labels
  ctx.fillStyle = '#888';
  ctx.font = '10px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = minVal + (range * i) / 4;
    const y = toY(v);
    ctx.beginPath();
    ctx.strokeStyle = '#eee';
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), pad.left - 5, y + 3);
  }

  if (chart.type === 'bar') {
    const barW = Math.max(4, cw / data.length * 0.7);
    const gap = cw / data.length;
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + gap * i + (gap - barW) / 2;
      const barH = ((data[i] - minVal) / range) * ch;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, pad.top + ch - barH, barW, barH);
      // Label
      ctx.fillStyle = '#555';
      ctx.font = '9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i] || String(i + 1), x + barW / 2, pad.top + ch + 14);
    }
  } else if (chart.type === 'line' || chart.type === 'area') {
    ctx.beginPath();
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2;
    for (let i = 0; i < data.length; i++) {
      const x = toX(i);
      const y = toY(data[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (chart.type === 'area') {
      ctx.lineTo(toX(data.length - 1), pad.top + ch);
      ctx.lineTo(toX(0), pad.top + ch);
      ctx.closePath();
      ctx.fillStyle = colors[0] + '40';
      ctx.fill();
    }
    ctx.stroke();
    // Points
    for (let i = 0; i < data.length; i++) {
      ctx.beginPath();
      ctx.arc(toX(i), toY(data[i]), 3, 0, Math.PI * 2);
      ctx.fillStyle = colors[0];
      ctx.fill();
    }
    // X labels
    ctx.fillStyle = '#555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i++) {
      ctx.fillText(labels[i] || String(i + 1), toX(i), pad.top + ch + 14);
    }
  } else if (chart.type === 'scatter') {
    for (let i = 0; i < data.length; i++) {
      ctx.beginPath();
      ctx.arc(toX(i), toY(data[i]), 4, 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
    }
    ctx.fillStyle = '#555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i++) {
      ctx.fillText(labels[i] || String(i + 1), toX(i), pad.top + ch + 14);
    }
  } else if (chart.type === 'pie') {
    const total = data.reduce((a, b) => a + Math.abs(b), 0) || 1;
    const cx = w / 2;
    const cy = pad.top + ch / 2;
    const radius = Math.min(cw, ch) / 2 - 10;
    let angle = -Math.PI / 2;
    for (let i = 0; i < data.length; i++) {
      const slice = (Math.abs(data[i]) / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      const mid = angle + slice / 2;
      const lx = cx + Math.cos(mid) * (radius * 0.65);
      const ly = cy + Math.sin(mid) * (radius * 0.65);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      if (slice > 0.15) ctx.fillText(labels[i] || '', lx, ly);
      angle += slice;
    }
  }
}

export function SheetChartOverlay({ chart, sheet, onMove, onResize, onDelete }: SheetChartProps) {
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

// Insert chart dialog
interface InsertChartDialogProps {
  onInsert: (config: Omit<ChartConfig, 'id' | 'x' | 'y'>) => void;
  onClose: () => void;
}

export function InsertChartDialog({ onInsert, onClose }: InsertChartDialogProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [dataRange, setDataRange] = useState('');
  const [labelRange, setLabelRange] = useState('');
  const [title, setTitle] = useState('');

  return (
    <div className="sheet-dialog-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 340, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 16px' }}>Insert Chart</h3>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Type:
          <select value={chartType} onChange={e => setChartType(e.target.value as ChartType)} style={{ marginLeft: 8 }}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
            <option value="scatter">Scatter</option>
            <option value="area">Area</option>
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Data Range:
          <input value={dataRange} onChange={e => setDataRange(e.target.value)} placeholder="e.g. B1:B10" style={{ marginLeft: 8, width: 120 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Label Range:
          <input value={labelRange} onChange={e => setLabelRange(e.target.value)} placeholder="e.g. A1:A10" style={{ marginLeft: 8, width: 120 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          Title:
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Chart title" style={{ marginLeft: 8, width: 160 }} />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => { if (dataRange) onInsert({ type: chartType, dataRange: dataRange.toUpperCase(), labelRange: labelRange.toUpperCase(), title, width: 400, height: 300 }); }}
            style={{ background: '#4285F4', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 4, cursor: 'pointer' }}
          >Insert</button>
        </div>
      </div>
    </div>
  );
}
