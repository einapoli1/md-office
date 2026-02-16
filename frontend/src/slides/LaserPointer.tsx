import { useState, useEffect, useCallback, useRef } from 'react';

interface Point { x: number; y: number; }

interface LaserPointerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function LaserPointer({ containerRef }: LaserPointerProps) {
  const [enabled, setEnabled] = useState(false);
  const [positions, setPositions] = useState<Point[]>([]);
  const [penMode, setPenMode] = useState(false);
  const [penColor, setPenColor] = useState<'red' | 'yellow'>('red');
  const [penStrokes, setPenStrokes] = useState<{ points: Point[]; color: string }[]>([]);
  const currentStroke = useRef<Point[]>([]);
  const drawing = useRef(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'l' || e.key === 'L') {
      setEnabled(v => !v);
      setPenMode(false);
    } else if (e.key === 'p' || e.key === 'P') {
      setPenMode(v => !v);
      setEnabled(false);
    } else if (e.key === 'c' || e.key === 'C') {
      setPenStrokes([]);
    } else if (e.key === 'y' || e.key === 'Y') {
      if (penMode) setPenColor(c => c === 'red' ? 'yellow' : 'red');
    }
  }, [penMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPositions(prev => [...prev.slice(-4), { x, y }]);
    };

    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [enabled, containerRef]);

  useEffect(() => {
    if (!penMode) return;
    const el = containerRef.current;
    if (!el) return;

    const getPoint = (e: MouseEvent): Point => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: MouseEvent) => {
      drawing.current = true;
      currentStroke.current = [getPoint(e)];
    };
    const onMove = (e: MouseEvent) => {
      if (!drawing.current) return;
      currentStroke.current.push(getPoint(e));
      // Force re-render with current stroke
      setPenStrokes(prev => [...prev]);
    };
    const onUp = () => {
      if (drawing.current && currentStroke.current.length > 1) {
        const color = penColor === 'red' ? 'rgba(255,0,0,0.7)' : 'rgba(255,255,0,0.5)';
        setPenStrokes(prev => [...prev, { points: [...currentStroke.current], color }]);
      }
      drawing.current = false;
      currentStroke.current = [];
    };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mouseleave', onUp);
    };
  }, [penMode, penColor, containerRef]);

  const pointsToPath = (pts: Point[]) => {
    if (pts.length < 2) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  };

  const activeColor = penColor === 'red' ? 'rgba(255,0,0,0.7)' : 'rgba(255,255,0,0.5)';
  const activeWidth = penColor === 'red' ? 3 : 12;

  return (
    <>
      {/* Laser pointer dots */}
      {enabled && positions.map((pos, i) => (
        <div
          key={i}
          className="laser-dot"
          style={{
            left: pos.x,
            top: pos.y,
            opacity: (i + 1) / positions.length,
            transform: `translate(-50%, -50%) scale(${0.5 + (i + 1) / positions.length * 0.5})`,
          }}
        />
      ))}

      {/* Pen strokes SVG */}
      {(penStrokes.length > 0 || (penMode && drawing.current)) && (
        <svg className="pen-overlay-svg">
          {penStrokes.map((stroke, i) => (
            <path
              key={i}
              d={pointsToPath(stroke.points)}
              stroke={stroke.color}
              strokeWidth={stroke.color.includes('255,255,0') ? 12 : 3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {penMode && drawing.current && currentStroke.current.length > 1 && (
            <path
              d={pointsToPath(currentStroke.current)}
              stroke={activeColor}
              strokeWidth={activeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      {/* Mode indicators */}
      {enabled && <div className="laser-indicator">🔴 Laser Pointer (L to toggle)</div>}
      {penMode && (
        <div className="laser-indicator">
          ✏️ Pen Mode ({penColor}) — Y: switch color, C: clear, P: toggle
        </div>
      )}
    </>
  );
}
