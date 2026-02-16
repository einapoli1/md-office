import React, { useRef, useEffect, useState, useCallback } from 'react';
import './whiteboard-styles.css';

// ── Types ──────────────────────────────────────────────────────────────────

type Tool = 'select' | 'pen' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text';

interface Point { x: number; y: number; pressure?: number }

interface WBElement {
  id: string;
  type: 'path' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text';
  points?: Point[];
  x?: number; y?: number; w?: number; h?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  text?: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  layerId: string;
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

interface HistoryEntry {
  elements: WBElement[];
  layers: Layer[];
}

interface WhiteboardProps {
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
  isDarkMode?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string { return `wb_${Date.now()}_${_idCounter++}`; }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── Component ──────────────────────────────────────────────────────────────

const Whiteboard: React.FC<WhiteboardProps> = ({ onClose, onInsert, isDarkMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<WBElement[]>([]);
  const [layers, setLayers] = useState<Layer[]>([{ id: 'layer0', name: 'Layer 1', visible: true, locked: false }]);
  const [activeLayerId, setActiveLayerId] = useState('layer0');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showLayers, setShowLayers] = useState(true);

  // History (undo/redo)
  const historyRef = useRef<HistoryEntry[]>([{ elements: [], layers: [{ id: 'layer0', name: 'Layer 1', visible: true, locked: false }] }]);
  const historyIdxRef = useRef(0);

  const pushHistory = useCallback((els: WBElement[], lyrs: Layer[]) => {
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    historyRef.current = h.slice(0, idx + 1);
    historyRef.current.push({ elements: JSON.parse(JSON.stringify(els)), layers: JSON.parse(JSON.stringify(lyrs)) });
    historyIdxRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const entry = historyRef.current[historyIdxRef.current];
    setElements(JSON.parse(JSON.stringify(entry.elements)));
    setLayers(JSON.parse(JSON.stringify(entry.layers)));
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const entry = historyRef.current[historyIdxRef.current];
    setElements(JSON.parse(JSON.stringify(entry.elements)));
    setLayers(JSON.parse(JSON.stringify(entry.layers)));
  }, []);

  // Drawing state refs
  const drawingRef = useRef(false);
  const currentElRef = useRef<WBElement | null>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);
  const dragStartRef = useRef<Point | null>(null);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spaceDownRef.current) { spaceDownRef.current = true; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.size > 0) {
          setElements(prev => {
            const next = prev.filter(el => !selected.has(el.id));
            pushHistory(next, layers);
            return next;
          });
          setSelected(new Set());
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [undo, redo, selected, pushHistory, layers]);

  // ── Coordinate transform ─────────────────────────────────────────────────
  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: sx, y: sy };
    return { x: (sx - rect.left - pan.x) / zoom, y: (sy - rect.top - pan.y) / zoom };
  }, [pan, zoom]);

  // ── Hit-test ──────────────────────────────────────────────────────────────
  const hitTest = useCallback((pt: Point): WBElement | null => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const layer = layers.find(l => l.id === el.layerId);
      if (layer && (!layer.visible || layer.locked)) continue;
      const t = 6 / zoom;
      if (el.type === 'rect' || el.type === 'ellipse' || el.type === 'text') {
        const ex = el.x ?? 0, ey = el.y ?? 0, ew = el.w ?? 0, eh = el.h ?? 0;
        const [mx, my] = [Math.min(ex, ex + ew), Math.min(ey, ey + eh)];
        const [Mx, My] = [Math.max(ex, ex + ew), Math.max(ey, ey + eh)];
        if (pt.x >= mx - t && pt.x <= Mx + t && pt.y >= my - t && pt.y <= My + t) return el;
      } else if (el.type === 'line' || el.type === 'arrow') {
        const x1 = el.x1 ?? 0, y1 = el.y1 ?? 0, x2 = el.x2 ?? 0, y2 = el.y2 ?? 0;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const proj = clamp(((pt.x - x1) * dx + (pt.y - y1) * dy) / (len * len), 0, 1);
        const px = x1 + proj * dx, py = y1 + proj * dy;
        if (Math.hypot(pt.x - px, pt.y - py) < t) return el;
      } else if (el.type === 'path' && el.points) {
        for (const p of el.points) {
          if (Math.hypot(pt.x - p.x, pt.y - p.y) < t) return el;
        }
      }
    }
    return null;
  }, [elements, layers, zoom]);

  // ── Pointer handlers ─────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    if (spaceDownRef.current) {
      panningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const pt = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'select') {
      const hit = hitTest(pt);
      if (hit) {
        if (e.shiftKey) {
          setSelected(prev => { const n = new Set(prev); if (n.has(hit.id)) n.delete(hit.id); else n.add(hit.id); return n; });
        } else {
          if (!selected.has(hit.id)) setSelected(new Set([hit.id]));
        }
        dragStartRef.current = pt;
        drawingRef.current = true;
      } else {
        setSelected(new Set());
      }
      return;
    }

    if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const el: WBElement = { id: uid(), type: 'text', x: pt.x, y: pt.y, w: 200, h: 30, text, stroke: strokeColor, strokeWidth, fill: fillColor, layerId: activeLayerId };
        setElements(prev => { const n = [...prev, el]; pushHistory(n, layers); return n; });
      }
      return;
    }

    drawingRef.current = true;

    if (tool === 'pen') {
      currentElRef.current = { id: uid(), type: 'path', points: [{ ...pt, pressure: e.pressure }], stroke: strokeColor, strokeWidth, fill: 'transparent', layerId: activeLayerId };
    } else if (tool === 'rect') {
      currentElRef.current = { id: uid(), type: 'rect', x: pt.x, y: pt.y, w: 0, h: 0, stroke: strokeColor, strokeWidth, fill: fillColor, layerId: activeLayerId };
    } else if (tool === 'ellipse') {
      currentElRef.current = { id: uid(), type: 'ellipse', x: pt.x, y: pt.y, w: 0, h: 0, stroke: strokeColor, strokeWidth, fill: fillColor, layerId: activeLayerId };
    } else if (tool === 'line') {
      currentElRef.current = { id: uid(), type: 'line', x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, stroke: strokeColor, strokeWidth, fill: 'transparent', layerId: activeLayerId };
    } else if (tool === 'arrow') {
      currentElRef.current = { id: uid(), type: 'arrow', x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, stroke: strokeColor, strokeWidth, fill: 'transparent', layerId: activeLayerId };
    }
  }, [tool, strokeColor, fillColor, strokeWidth, activeLayerId, screenToCanvas, hitTest, selected, pan, pushHistory, layers]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panningRef.current) {
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
      return;
    }
    if (!drawingRef.current) return;

    const pt = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'select' && dragStartRef.current && selected.size > 0) {
      const dx = pt.x - dragStartRef.current.x;
      const dy = pt.y - dragStartRef.current.y;
      dragStartRef.current = pt;
      setElements(prev => prev.map(el => {
        if (!selected.has(el.id)) return el;
        const copy = { ...el };
        if (copy.x !== undefined) copy.x += dx;
        if (copy.y !== undefined) copy.y += dy;
        if (copy.x1 !== undefined) copy.x1 += dx;
        if (copy.y1 !== undefined) copy.y1 += dy;
        if (copy.x2 !== undefined) copy.x2 += dx;
        if (copy.y2 !== undefined) copy.y2 += dy;
        if (copy.points) copy.points = copy.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
        return copy;
      }));
      return;
    }

    const cur = currentElRef.current;
    if (!cur) return;

    if (cur.type === 'path' && cur.points) {
      cur.points.push({ ...pt, pressure: e.pressure });
    } else if (cur.type === 'rect' || cur.type === 'ellipse') {
      cur.w = pt.x - (cur.x ?? 0);
      cur.h = pt.y - (cur.y ?? 0);
    } else if (cur.type === 'line' || cur.type === 'arrow') {
      cur.x2 = pt.x;
      cur.y2 = pt.y;
    }
    // Force re-render for live preview
    setElements(prev => [...prev]);
  }, [tool, screenToCanvas, selected]);

  const onPointerUp = useCallback(() => {
    if (panningRef.current) { panningRef.current = false; return; }
    if (!drawingRef.current) { drawingRef.current = false; return; }
    drawingRef.current = false;

    if (tool === 'select') {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        pushHistory(elements, layers);
      }
      return;
    }

    const cur = currentElRef.current;
    if (cur) {
      setElements(prev => { const n = [...prev, cur]; pushHistory(n, layers); return n; });
      currentElRef.current = null;
    }
  }, [tool, elements, pushHistory, layers]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => clamp(prev * factor, 0.1, 10));
  }, []);

  // ── Render to canvas ─────────────────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const allEls = currentElRef.current && drawingRef.current ? [...elements, currentElRef.current] : elements;

    for (const el of allEls) {
      const layer = layers.find(l => l.id === el.layerId);
      if (layer && !layer.visible) continue;
      ctx.save();
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'path' && el.points && el.points.length > 0) {
        ctx.beginPath();
        const pts = el.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i];
          const lw = el.strokeWidth * (p.pressure ?? 0.5) * 2;
          ctx.lineWidth = lw;
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      } else if (el.type === 'rect') {
        const fx = el.x ?? 0, fy = el.y ?? 0, fw = el.w ?? 0, fh = el.h ?? 0;
        if (el.fill && el.fill !== 'transparent') { ctx.fillStyle = el.fill; ctx.fillRect(fx, fy, fw, fh); }
        ctx.strokeRect(fx, fy, fw, fh);
      } else if (el.type === 'ellipse') {
        const fx = el.x ?? 0, fy = el.y ?? 0, fw = el.w ?? 0, fh = el.h ?? 0;
        ctx.beginPath();
        ctx.ellipse(fx + fw / 2, fy + fh / 2, Math.abs(fw / 2), Math.abs(fh / 2), 0, 0, Math.PI * 2);
        if (el.fill && el.fill !== 'transparent') { ctx.fillStyle = el.fill; ctx.fill(); }
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x1 ?? 0, el.y1 ?? 0);
        ctx.lineTo(el.x2 ?? 0, el.y2 ?? 0);
        ctx.stroke();
      } else if (el.type === 'arrow') {
        const ax1 = el.x1 ?? 0, ay1 = el.y1 ?? 0, ax2 = el.x2 ?? 0, ay2 = el.y2 ?? 0;
        ctx.beginPath();
        ctx.moveTo(ax1, ay1);
        ctx.lineTo(ax2, ay2);
        ctx.stroke();
        // arrowhead
        const angle = Math.atan2(ay2 - ay1, ax2 - ax1);
        const hl = 12;
        ctx.beginPath();
        ctx.moveTo(ax2, ay2);
        ctx.lineTo(ax2 - hl * Math.cos(angle - 0.4), ay2 - hl * Math.sin(angle - 0.4));
        ctx.moveTo(ax2, ay2);
        ctx.lineTo(ax2 - hl * Math.cos(angle + 0.4), ay2 - hl * Math.sin(angle + 0.4));
        ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `${el.strokeWidth * 6 + 10}px sans-serif`;
        ctx.fillStyle = el.stroke;
        ctx.fillText(el.text ?? '', el.x ?? 0, (el.y ?? 0) + (el.strokeWidth * 6 + 10));
      }

      // selection highlight
      if (selected.has(el.id)) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        if (el.type === 'rect' || el.type === 'ellipse' || el.type === 'text') {
          ctx.strokeRect((el.x ?? 0) - 4, (el.y ?? 0) - 4, (el.w ?? 0) + 8, (el.h ?? 0) + 8);
        } else if (el.type === 'line' || el.type === 'arrow') {
          const bx = Math.min(el.x1 ?? 0, el.x2 ?? 0) - 4;
          const by = Math.min(el.y1 ?? 0, el.y2 ?? 0) - 4;
          const bw = Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)) + 8;
          const bh = Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)) + 8;
          ctx.strokeRect(bx, by, bw, bh);
        } else if (el.type === 'path' && el.points && el.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of el.points) {
            if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
          }
          ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
        }
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    ctx.restore();
  }, [elements, layers, pan, zoom, selected]);

  useEffect(() => {
    const id = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(id);
  }, [renderCanvas]);

  // Resize observer
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => renderCanvas());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderCanvas]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportImage = useCallback((format: 'png' | 'svg') => {
    if (format === 'png') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = 'whiteboard.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      // Basic SVG export
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elements) {
        const pts: Point[] = [];
        if (el.points) pts.push(...el.points);
        if (el.x !== undefined && el.y !== undefined) { pts.push({ x: el.x, y: el.y }); if (el.w && el.h) pts.push({ x: el.x + el.w, y: el.y + el.h }); }
        if (el.x1 !== undefined && el.y1 !== undefined) pts.push({ x: el.x1, y: el.y1 });
        if (el.x2 !== undefined && el.y2 !== undefined) pts.push({ x: el.x2, y: el.y2 });
        for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
      }
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300; }
      const pad = 20;
      const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
      const svgParts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX - pad} ${minY - pad} ${w} ${h}">`];
      for (const el of elements) {
        const layer = layers.find(l => l.id === el.layerId);
        if (layer && !layer.visible) continue;
        if (el.type === 'path' && el.points && el.points.length > 1) {
          const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
          svgParts.push(`<path d="${d}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="round"/>`);
        } else if (el.type === 'rect') {
          svgParts.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" fill="${el.fill === 'transparent' ? 'none' : el.fill}"/>`);
        } else if (el.type === 'ellipse') {
          const cx = (el.x ?? 0) + (el.w ?? 0) / 2, cy = (el.y ?? 0) + (el.h ?? 0) / 2;
          svgParts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs((el.w ?? 0) / 2)}" ry="${Math.abs((el.h ?? 0) / 2)}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" fill="${el.fill === 'transparent' ? 'none' : el.fill}"/>`);
        } else if (el.type === 'line') {
          svgParts.push(`<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>`);
        } else if (el.type === 'arrow') {
          svgParts.push(`<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" marker-end="url(#arrowhead)"/>`);
        } else if (el.type === 'text') {
          svgParts.push(`<text x="${el.x}" y="${(el.y ?? 0) + 16}" fill="${el.stroke}" font-size="${el.strokeWidth * 6 + 10}">${el.text ?? ''}</text>`);
        }
      }
      svgParts.push('</svg>');
      const blob = new Blob([svgParts.join('\n')], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = 'whiteboard.svg';
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  }, [elements, layers]);

  const handleInsert = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onInsert(canvas.toDataURL('image/png'));
  }, [onInsert]);

  // ── Layer operations ──────────────────────────────────────────────────────
  const addLayer = () => {
    const l: Layer = { id: uid(), name: `Layer ${layers.length + 1}`, visible: true, locked: false };
    const next = [...layers, l];
    setLayers(next);
    setActiveLayerId(l.id);
    pushHistory(elements, next);
  };
  const toggleLayerVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };
  const toggleLayerLock = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
  };
  const moveLayer = (id: string, dir: -1 | 1) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const tools: { key: Tool; label: string; icon: string }[] = [
    { key: 'select', label: 'Select', icon: '⇲' },
    { key: 'pen', label: 'Pen', icon: '✏️' },
    { key: 'rect', label: 'Rectangle', icon: '▭' },
    { key: 'ellipse', label: 'Ellipse', icon: '◯' },
    { key: 'line', label: 'Line', icon: '╱' },
    { key: 'arrow', label: 'Arrow', icon: '→' },
    { key: 'text', label: 'Text', icon: 'T' },
  ];

  return (
    <div className="wb-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`wb-modal${isDarkMode ? ' dark' : ''}`} onClick={e => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="wb-toolbar">
          {tools.map(t => (
            <button key={t.key} className={tool === t.key ? 'active' : ''} onClick={() => setTool(t.key)} title={t.label}>
              {t.icon} {t.label}
            </button>
          ))}
          <span className="sep" />
          <label title="Stroke color">
            <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} />
          </label>
          <label title="Fill color">
            <input type="color" value={fillColor === 'transparent' ? '#ffffff' : fillColor} onChange={e => setFillColor(e.target.value)} />
          </label>
          <button onClick={() => setFillColor('transparent')} title="No fill" style={{ fontSize: 11 }}>∅ Fill</button>
          <span className="sep" />
          <label title="Stroke width">
            <input type="range" min={1} max={20} value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} />
          </label>
          <span style={{ fontSize: 11, minWidth: 20 }}>{strokeWidth}px</span>
          <span className="sep" />
          <button onClick={undo} title="Undo (⌘Z)">↩ Undo</button>
          <button onClick={redo} title="Redo (⌘⇧Z)">↪ Redo</button>
          <span className="sep" />
          <button onClick={() => exportImage('png')} title="Export PNG">📥 PNG</button>
          <button onClick={() => exportImage('svg')} title="Export SVG">📥 SVG</button>
          <span className="sep" />
          <button onClick={() => setShowLayers(p => !p)} title="Toggle layers panel">
            {showLayers ? '◧' : '◨'} Layers
          </button>
        </div>

        {/* Body */}
        <div className="wb-body">
          <div
            className="wb-canvas-wrap"
            ref={wrapRef}
            style={{ cursor: spaceDownRef.current ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onWheel={onWheel}
            />
          </div>
          {showLayers && (
            <div className="wb-layers">
              <div className="wb-layers-header">
                <span>Layers</span>
                <button onClick={addLayer} title="Add layer" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>+</button>
              </div>
              <div className="wb-layers-list">
                {[...layers].reverse().map(l => (
                  <div key={l.id} className={`wb-layer-item${l.id === activeLayerId ? ' selected' : ''}`} onClick={() => setActiveLayerId(l.id)}>
                    <button onClick={e => { e.stopPropagation(); toggleLayerVisibility(l.id); }} title={l.visible ? 'Hide' : 'Show'}>{l.visible ? '👁' : '🚫'}</button>
                    <button onClick={e => { e.stopPropagation(); toggleLayerLock(l.id); }} title={l.locked ? 'Unlock' : 'Lock'}>{l.locked ? '🔒' : '🔓'}</button>
                    <span className="layer-name">{l.name}</span>
                    <button onClick={e => { e.stopPropagation(); moveLayer(l.id, -1); }} title="Move down">▼</button>
                    <button onClick={e => { e.stopPropagation(); moveLayer(l.id, 1); }} title="Move up">▲</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="wb-bottom">
          <span className="wb-zoom-info">{Math.round(zoom * 100)}% — Scroll to zoom, Space+drag to pan</span>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleInsert}>Insert into Document</button>
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
