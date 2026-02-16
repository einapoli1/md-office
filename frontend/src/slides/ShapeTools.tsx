import { useState, useCallback, useRef, useEffect } from 'react';
import { SlideShape, genShapeId } from './slideModel';

export type ShapeType = SlideShape['type'];

const SHAPE_LIST: { type: ShapeType; label: string; icon: string }[] = [
  { type: 'rectangle', label: 'Rectangle', icon: '▬' },
  { type: 'rounded-rectangle', label: 'Rounded Rect', icon: '▢' },
  { type: 'circle', label: 'Circle', icon: '●' },
  { type: 'ellipse', label: 'Ellipse', icon: '⬮' },
  { type: 'triangle', label: 'Triangle', icon: '▲' },
  { type: 'diamond', label: 'Diamond', icon: '◆' },
  { type: 'star', label: 'Star', icon: '★' },
  { type: 'arrow', label: 'Arrow', icon: '➜' },
  { type: 'line', label: 'Line', icon: '─' },
  { type: 'callout', label: 'Callout', icon: '💬' },
];

interface ShapePickerProps {
  onSelect: (type: ShapeType) => void;
  activeShape: ShapeType | null;
}

export function ShapePicker({ onSelect, activeShape }: ShapePickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shape-picker-wrapper">
      <button
        className={`toolbar-btn ${activeShape ? 'shape-active' : ''}`}
        onClick={() => setOpen(!open)}
        title="Insert Shape"
      >
        ⬡ Shapes
      </button>
      {open && (
        <div className="shape-picker-dropdown">
          {SHAPE_LIST.map(s => (
            <button
              key={s.type}
              className={`shape-pick-item ${activeShape === s.type ? 'selected' : ''}`}
              onClick={() => { onSelect(s.type); setOpen(false); }}
              title={s.label}
            >
              <span className="shape-pick-icon">{s.icon}</span>
              <span className="shape-pick-label">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render shape as SVG */
export function renderShapeSVG(shape: SlideShape): JSX.Element {
  const { type, width, height, fill, stroke, strokeWidth } = shape;
  const sw = strokeWidth;
  const common = { fill, stroke, strokeWidth: sw };

  switch (type) {
    case 'rectangle':
      return <rect x={sw/2} y={sw/2} width={width - sw} height={height - sw} {...common} />;
    case 'rounded-rectangle':
      return <rect x={sw/2} y={sw/2} width={width - sw} height={height - sw} rx={12} ry={12} {...common} />;
    case 'circle':
      return <circle cx={width/2} cy={height/2} r={Math.min(width, height)/2 - sw/2} {...common} />;
    case 'ellipse':
      return <ellipse cx={width/2} cy={height/2} rx={width/2 - sw/2} ry={height/2 - sw/2} {...common} />;
    case 'triangle': {
      const pts = `${width/2},${sw/2} ${sw/2},${height-sw/2} ${width-sw/2},${height-sw/2}`;
      return <polygon points={pts} {...common} />;
    }
    case 'diamond': {
      const pts = `${width/2},${sw/2} ${width-sw/2},${height/2} ${width/2},${height-sw/2} ${sw/2},${height/2}`;
      return <polygon points={pts} {...common} />;
    }
    case 'star': {
      const cx = width/2, cy = height/2;
      const outer = Math.min(width,height)/2 - sw/2;
      const inner = outer * 0.4;
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
      }
      return <polygon points={pts.join(' ')} {...common} />;
    }
    case 'arrow':
      return (
        <g {...common}>
          <line x1={sw} y1={height/2} x2={width * 0.65} y2={height/2} strokeWidth={sw || 2} />
          <polygon points={`${width * 0.6},${sw} ${width - sw},${height/2} ${width * 0.6},${height - sw}`} />
        </g>
      );
    case 'line':
      return <line x1={sw} y1={height/2} x2={width - sw} y2={height/2} stroke={stroke} strokeWidth={sw || 2} />;
    case 'callout': {
      const tailH = height * 0.2;
      const body = height - tailH;
      return (
        <g {...common}>
          <rect x={sw/2} y={sw/2} width={width - sw} height={body - sw} rx={8} ry={8} />
          <polygon points={`${width*0.2},${body} ${width*0.3},${height-sw/2} ${width*0.4},${body}`} />
        </g>
      );
    }
    default:
      return <rect x={0} y={0} width={width} height={height} {...common} />;
  }
}

interface ShapeOverlayProps {
  shapes: SlideShape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (shapes: SlideShape[]) => void;
  drawingTool: ShapeType | null;
  onDrawEnd: () => void;
}

export function ShapeOverlay({ shapes, selectedId, onSelect, onUpdate, drawingTool, onDrawEnd }: ShapeOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; current: SlideShape } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number } | null>(null);

  const getSVGPoint = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!drawingTool) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const newShape: SlideShape = {
      id: genShapeId(), type: drawingTool,
      x: pt.x, y: pt.y, width: 1, height: 1,
      fill: 'rgba(26,115,232,0.15)', stroke: '#1a73e8', strokeWidth: 2, text: '',
    };
    setDrawing({ startX: pt.x, startY: pt.y, current: newShape });
  }, [drawingTool, getSVGPoint]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (drawing) {
      const pt = getSVGPoint(e);
      const w = Math.abs(pt.x - drawing.startX);
      const h = Math.abs(pt.y - drawing.startY);
      const x = Math.min(pt.x, drawing.startX);
      const y = Math.min(pt.y, drawing.startY);
      setDrawing(d => d ? { ...d, current: { ...d.current, x, y, width: Math.max(w, 4), height: Math.max(h, 4) } } : null);
    } else if (dragging) {
      const pt = getSVGPoint(e);
      const dx = pt.x - dragging.startX;
      const dy = pt.y - dragging.startY;
      onUpdate(shapes.map(s => s.id === dragging.id ? { ...s, x: dragging.origX + dx, y: dragging.origY + dy } : s));
    } else if (resizing) {
      const pt = getSVGPoint(e);
      const dw = pt.x - resizing.startX;
      const dh = pt.y - resizing.startY;
      onUpdate(shapes.map(s => s.id === resizing.id ? { ...s, width: Math.max(20, resizing.origW + dw), height: Math.max(20, resizing.origH + dh) } : s));
    }
  }, [drawing, dragging, resizing, getSVGPoint, shapes, onUpdate]);

  const handleMouseUp = useCallback(() => {
    if (drawing && drawing.current.width > 5 && drawing.current.height > 5) {
      onUpdate([...shapes, drawing.current]);
      onSelect(drawing.current.id);
    }
    setDrawing(null);
    setDragging(null);
    setResizing(null);
    if (drawing) onDrawEnd();
  }, [drawing, shapes, onUpdate, onSelect, onDrawEnd]);

  // Delete key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Only delete if not typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        onUpdate(shapes.filter(s => s.id !== selectedId));
        onSelect(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, shapes, onUpdate, onSelect]);

  const allShapes = drawing ? [...shapes, drawing.current] : shapes;

  return (
    <svg
      ref={svgRef}
      className="shape-overlay-svg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: drawingTool ? 'crosshair' : 'default' }}
    >
      {allShapes.map(shape => (
        <g
          key={shape.id}
          transform={`translate(${shape.x}, ${shape.y})`}
          onClick={(e) => { e.stopPropagation(); if (!drawingTool) onSelect(shape.id); }}
          onMouseDown={(e) => {
            if (drawingTool) return;
            e.stopPropagation();
            onSelect(shape.id);
            const pt = getSVGPoint(e);
            setDragging({ id: shape.id, startX: pt.x, startY: pt.y, origX: shape.x, origY: shape.y });
          }}
          style={{ cursor: drawingTool ? 'crosshair' : 'move' }}
        >
          {renderShapeSVG(shape)}
          {shape.text && (
            <text
              x={shape.width / 2} y={shape.height / 2}
              textAnchor="middle" dominantBaseline="central"
              fill={shape.stroke} fontSize={14} style={{ pointerEvents: 'none' }}
            >
              {shape.text}
            </text>
          )}
          {selectedId === shape.id && (
            <>
              <rect x={-2} y={-2} width={shape.width + 4} height={shape.height + 4}
                fill="none" stroke="#1a73e8" strokeWidth={1} strokeDasharray="4,2" />
              {/* Resize handle */}
              <rect
                x={shape.width - 4} y={shape.height - 4} width={8} height={8}
                fill="#1a73e8" stroke="#fff" strokeWidth={1} style={{ cursor: 'nwse-resize' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const pt = getSVGPoint(e);
                  setResizing({ id: shape.id, startX: pt.x, startY: pt.y, origW: shape.width, origH: shape.height, origX: shape.x, origY: shape.y });
                }}
              />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

interface ShapePropertyEditorProps {
  shape: SlideShape;
  onUpdate: (shape: SlideShape) => void;
}

export function ShapePropertyEditor({ shape, onUpdate }: ShapePropertyEditorProps) {
  return (
    <div className="shape-property-editor">
      <label>Fill
        <input type="color" value={shape.fill.startsWith('rgba') ? '#1a73e8' : shape.fill}
          onChange={e => onUpdate({ ...shape, fill: e.target.value })} />
      </label>
      <label>Stroke
        <input type="color" value={shape.stroke}
          onChange={e => onUpdate({ ...shape, stroke: e.target.value })} />
      </label>
      <label>Width
        <input type="number" value={shape.strokeWidth} min={0} max={20} style={{ width: 48 }}
          onChange={e => onUpdate({ ...shape, strokeWidth: Number(e.target.value) })} />
      </label>
      <label>Text
        <input type="text" value={shape.text} style={{ width: 80 }}
          onChange={e => onUpdate({ ...shape, text: e.target.value })} />
      </label>
    </div>
  );
}
