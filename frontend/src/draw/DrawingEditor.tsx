import React, { useRef, useState, useEffect, useCallback } from 'react';
import DrawToolbar from './DrawToolbar';
import DrawStatusBar from './DrawStatusBar';
import {
  DrawDocument, DrawObject, DrawToolType, BackgroundStyle, Point,
  deserializeDocument, serializeDocument, DrawHistory, genId,
  exportToPngDataUrl, exportToSvg,
} from './drawModel';
import './draw-styles.css';

interface DrawingEditorProps {
  content: string;
  onChange: (data: string) => void;
  filePath: string;
}

const DrawingEditor: React.FC<DrawingEditorProps> = ({ content, onChange, filePath: _filePath }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<DrawDocument>(() => deserializeDocument(content));
  const [history] = useState(() => new DrawHistory());
  const [tool, setTool] = useState<DrawToolType>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [opacity, setOpacity] = useState(1);
  const [activeLayer, _setActiveLayer] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const panOrigin = useRef<Point>({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const dragOffset = useRef<Point>({ x: 0, y: 0 });
  const isDragging = useRef(false);

  // Sync from parent content
  useEffect(() => {
    const parsed = deserializeDocument(content);
    setDoc(parsed);
  }, [content]);

  // Persist changes
  const persistDoc = useCallback((d: DrawDocument) => {
    setDoc(d);
    onChange(serializeDocument(d));
  }, [onChange]);

  // ---------- Canvas rendering ----------
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Background
    drawBackground(ctx, doc.width, doc.height, doc.background);

    // Objects
    for (const obj of doc.objects) {
      const layer = doc.layers.find(l => l.id === obj.layer);
      if (layer && !layer.visible) continue;
      drawObject(ctx, obj, obj.id === selectedId);
    }

    // Current stroke preview
    if (drawing && currentPoints.length > 1) {
      const preview: DrawObject = {
        id: '__preview__',
        type: tool,
        points: currentPoints,
        color: tool === 'eraser' ? '#ffffff' : color,
        width: strokeWidth,
        opacity: tool === 'highlighter' ? 0.4 : opacity,
        layer: activeLayer,
      };
      drawObject(ctx, preview, false);
    }

    ctx.restore();
  }, [doc, drawing, currentPoints, tool, color, strokeWidth, opacity, activeLayer, zoom, pan, selectedId]);

  useEffect(() => {
    const id = requestAnimationFrame(render);
    return () => cancelAnimationFrame(id);
  }, [render]);

  // Space key for panning
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) { spaceDown.current = true; e.preventDefault(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && tool === 'select') {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  // ---------- Mouse handlers ----------
  const canvasToDoc = (clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    // Middle button or space → pan
    if (e.button === 1 || spaceDown.current) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      return;
    }

    const pt = canvasToDoc(e.clientX, e.clientY);

    if (tool === 'select') {
      const hit = hitTest(doc, pt);
      setSelectedId(hit?.id ?? null);
      if (hit) {
        isDragging.current = true;
        dragOffset.current = { x: pt.x - (hit.points[0]?.x ?? 0), y: pt.y - (hit.points[0]?.y ?? 0) };
      }
      return;
    }

    if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const obj: DrawObject = {
          id: genId(), type: 'text', points: [pt], color, width: strokeWidth,
          opacity, layer: activeLayer, text, fontSize: strokeWidth * 4 + 8,
        };
        history.push({ type: 'add', objects: [obj] });
        persistDoc({ ...doc, objects: [...doc.objects, obj] });
      }
      return;
    }

    setDrawing(true);
    setCurrentPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan({
        x: panOrigin.current.x + (e.clientX - panStart.current.x),
        y: panOrigin.current.y + (e.clientY - panStart.current.y),
      });
      return;
    }

    if (tool === 'select' && isDragging.current && selectedId) {
      const pt = canvasToDoc(e.clientX, e.clientY);
      const obj = doc.objects.find(o => o.id === selectedId);
      if (!obj) return;
      const dx = pt.x - dragOffset.current.x - (obj.points[0]?.x ?? 0);
      const dy = pt.y - dragOffset.current.y - (obj.points[0]?.y ?? 0);
      const moved: DrawObject = {
        ...obj,
        points: obj.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
      };
      setDoc(prev => ({ ...prev, objects: prev.objects.map(o => o.id === selectedId ? moved : o) }));
      return;
    }

    if (!drawing) return;
    const pt = canvasToDoc(e.clientX, e.clientY);

    if (['line', 'rectangle', 'circle', 'arrow'].includes(tool)) {
      setCurrentPoints(prev => [prev[0], pt]);
    } else {
      setCurrentPoints(prev => [...prev, pt]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);

    if (isPanning) { setIsPanning(false); return; }

    if (tool === 'select' && isDragging.current && selectedId) {
      const obj = doc.objects.find(o => o.id === selectedId);
      if (obj) {
        history.push({ type: 'modify', objects: [obj], previous: [obj] });
        onChange(serializeDocument(doc));
      }
      isDragging.current = false;
      return;
    }

    if (!drawing) return;
    setDrawing(false);

    if (currentPoints.length < 2) { setCurrentPoints([]); return; }

    if (tool === 'eraser') {
      // Remove objects that intersect eraser path
      const erased = doc.objects.filter(o => {
        return currentPoints.some(ep =>
          o.points.some(op => Math.hypot(ep.x - op.x, ep.y - op.y) < strokeWidth * 2)
        );
      });
      if (erased.length > 0) {
        history.push({ type: 'remove', objects: erased });
        const erasedIds = new Set(erased.map(o => o.id));
        persistDoc({ ...doc, objects: doc.objects.filter(o => !erasedIds.has(o.id)) });
      }
      setCurrentPoints([]);
      return;
    }

    const obj: DrawObject = {
      id: genId(),
      type: tool,
      points: currentPoints,
      color,
      width: strokeWidth,
      opacity: tool === 'highlighter' ? 0.4 : opacity,
      layer: activeLayer,
    };

    history.push({ type: 'add', objects: [obj] });
    persistDoc({ ...doc, objects: [...doc.objects, obj] });
    setCurrentPoints([]);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.min(5, Math.max(0.1, z * delta)));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  // ---------- Actions ----------
  const handleUndo = () => {
    const newDoc = history.undo(doc);
    persistDoc(newDoc);
  };
  const handleRedo = () => {
    const newDoc = history.redo(doc);
    persistDoc(newDoc);
  };
  const handleClear = () => {
    if (doc.objects.length === 0) return;
    history.push({ type: 'clear', objects: doc.objects });
    persistDoc({ ...doc, objects: [] });
    setSelectedId(null);
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    const obj = doc.objects.find(o => o.id === selectedId);
    if (!obj) return;
    history.push({ type: 'remove', objects: [obj] });
    persistDoc({ ...doc, objects: doc.objects.filter(o => o.id !== selectedId) });
    setSelectedId(null);
  };
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = exportToPngDataUrl(canvas);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawing.png';
    a.click();
  };
  const handleExportSvg = () => {
    const svg = exportToSvg(doc);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'drawing.svg';
    a.click();
  };
  const handleBackgroundChange = (bg: BackgroundStyle) => {
    persistDoc({ ...doc, background: bg });
  };

  return (
    <div className="draw-editor">
      <DrawToolbar
        activeTool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        opacity={opacity}
        onOpacityChange={setOpacity}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        background={doc.background}
        onBackgroundChange={handleBackgroundChange}
      />
      <div className="draw-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="draw-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          style={{ cursor: isPanning || spaceDown.current ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
        />
      </div>
      <DrawStatusBar
        zoom={zoom}
        canvasWidth={doc.width}
        canvasHeight={doc.height}
        currentTool={tool}
        activeLayer={activeLayer}
        objectCount={doc.objects.length}
      />
    </div>
  );
};

// ---------- Drawing helpers ----------

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, style: BackgroundStyle) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (style === 'none') return;

  ctx.fillStyle = '#d0d0d0';
  const step = 20;
  if (style === 'grid') {
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  } else {
    for (let x = 0; x <= w; x += step) {
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawObject(ctx: CanvasRenderingContext2D, obj: DrawObject, selected: boolean) {
  ctx.save();
  ctx.globalAlpha = obj.opacity;
  ctx.strokeStyle = obj.color;
  ctx.fillStyle = obj.color;
  ctx.lineWidth = obj.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (obj.type) {
    case 'pen':
    case 'highlighter': {
      if (obj.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'line': {
      if (obj.points.length < 2) break;
      const [p1, p2] = [obj.points[0], obj.points[obj.points.length - 1]];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      if (obj.points.length < 2) break;
      const [a1, a2] = [obj.points[0], obj.points[obj.points.length - 1]];
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(a2.y - a1.y, a2.x - a1.x);
      const headLen = obj.width * 3;
      ctx.beginPath();
      ctx.moveTo(a2.x, a2.y);
      ctx.lineTo(a2.x - headLen * Math.cos(angle - Math.PI / 6), a2.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(a2.x, a2.y);
      ctx.lineTo(a2.x - headLen * Math.cos(angle + Math.PI / 6), a2.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'rectangle': {
      if (obj.points.length < 2) break;
      const [r1, r2] = obj.points;
      ctx.strokeRect(
        Math.min(r1.x, r2.x), Math.min(r1.y, r2.y),
        Math.abs(r2.x - r1.x), Math.abs(r2.y - r1.y)
      );
      break;
    }
    case 'circle': {
      if (obj.points.length < 2) break;
      const [c, edge] = obj.points;
      const r = Math.hypot(edge.x - c.x, edge.y - c.y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text': {
      const fontSize = obj.fontSize ?? 16;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(obj.text ?? '', obj.points[0]?.x ?? 0, obj.points[0]?.y ?? 0);
      break;
    }
    default:
      break;
  }

  // Selection highlight
  if (selected) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const bounds = getBounds(obj);
    if (bounds) {
      ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function getBounds(obj: DrawObject): { x: number; y: number; w: number; h: number } | null {
  if (obj.points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of obj.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX || 20, h: maxY - minY || 20 };
}

function hitTest(doc: DrawDocument, pt: Point): DrawObject | null {
  // Reverse order — top objects first
  for (let i = doc.objects.length - 1; i >= 0; i--) {
    const obj = doc.objects[i];
    const bounds = getBounds(obj);
    if (!bounds) continue;
    const margin = Math.max(obj.width, 8);
    if (
      pt.x >= bounds.x - margin && pt.x <= bounds.x + bounds.w + margin &&
      pt.y >= bounds.y - margin && pt.y <= bounds.y + bounds.h + margin
    ) {
      return obj;
    }
  }
  return null;
}

export default DrawingEditor;
