import { useState, useEffect, useRef } from 'react';
import { TransitionType } from './slideModel';

const TRANSITION_ANIMATIONS: Record<TransitionType, (ctx: CanvasRenderingContext2D, progress: number, w: number, h: number) => void> = {
  none: (ctx, _p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', w / 2, h / 2 + 4);
  },
  fade: (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.globalAlpha = 1 - p;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.globalAlpha = p;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  },
  'slide-left': (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.fillRect(-p * w, 0, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(w - p * w, 0, w, h);
  },
  'slide-right': (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.fillRect(p * w, 0, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(-w + p * w, 0, w, h);
  },
  'slide-up': (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.fillRect(0, -p * h, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(0, h - p * h, w, h);
  },
  zoom: (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.globalAlpha = 1 - p;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.globalAlpha = p;
    const s = p;
    const cx = w / 2, cy = h / 2;
    ctx.fillRect(cx - (w * s) / 2, cy - (h * s) / 2, w * s, h * s);
    ctx.globalAlpha = 1;
  },
  dissolve: (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#48bb78';
    const cellSize = 8;
    for (let x = 0; x < w; x += cellSize) {
      for (let y = 0; y < h; y += cellSize) {
        if (Math.random() < p) ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  },
  wipe: (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(0, 0, w * p, h);
  },
  morph: (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.globalAlpha = 1 - p;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.globalAlpha = p;
    ctx.fillRect(0, 0, w, h);
    // Draw morphing circle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const r = 8 + p * 8;
    ctx.arc(w * 0.3 + p * w * 0.4, h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  'zoom-rotate': (ctx, p, w, h) => {
    ctx.save();
    ctx.fillStyle = '#4299e1';
    ctx.globalAlpha = 1 - p;
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(p * Math.PI * 0.5);
    ctx.scale(p, p);
    ctx.fillStyle = '#48bb78';
    ctx.globalAlpha = p;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;
    ctx.restore();
  },
  curtain: (ctx, p, w, h) => {
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4299e1';
    const half = w / 2;
    ctx.fillRect(0, 0, half * (1 - p), h);
    ctx.fillRect(w - half * (1 - p), 0, half * (1 - p), h);
  },
  flip: (ctx, p, w, h) => {
    ctx.save();
    const scaleX = Math.abs(Math.cos(p * Math.PI));
    ctx.translate(w / 2, 0);
    ctx.scale(scaleX, 1);
    ctx.fillStyle = p < 0.5 ? '#4299e1' : '#48bb78';
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.restore();
  },
  cube: (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    const w1 = w * (1 - p);
    ctx.fillRect(0, 0, w1, h);
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(w1, 0, w * p, h);
  },
  swipe: (ctx, p, w, h) => {
    ctx.fillStyle = '#4299e1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#48bb78';
    ctx.beginPath();
    ctx.arc(0, h / 2, p * w * 1.5, 0, Math.PI * 2);
    ctx.fill();
  },
};

interface TransitionPreviewProps {
  transition: TransitionType;
  visible: boolean;
  x: number;
  y: number;
}

export default function TransitionPreview({ transition, visible, x, y }: TransitionPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!visible || !canvasRef.current) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 120, h = 80;
    let startTime = 0;
    const duration = 1500;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      const drawFn = TRANSITION_ANIMATIONS[transition] || TRANSITION_ANIMATIONS.none;
      drawFn(ctx, progress, w, h);

      // Draw labels
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      if (progress < 0.5) ctx.fillText('A → B', w / 2, h - 6);
      else ctx.fillText('B', w / 2, h - 6);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // Loop
        startTime = 0;
        animRef.current = requestAnimationFrame(animate);
      }
      setTick(t => t + 1);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [visible, transition]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', left: x, top: y,
      background: '#1a202c', borderRadius: 6, padding: 4,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <canvas ref={canvasRef} width={120} height={80} style={{ borderRadius: 4, display: 'block' }} />
      <div style={{ color: '#cbd5e0', fontSize: 10, textAlign: 'center', marginTop: 2 }}>
        {transition}
      </div>
    </div>
  );
}

/** Wrapper for transition select with hover preview */
interface TransitionSelectWithPreviewProps {
  value: TransitionType;
  onChange: (t: TransitionType) => void;
}

const TRANSITIONS: TransitionType[] = [
  'none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'zoom',
  'dissolve', 'wipe', 'morph', 'zoom-rotate', 'curtain', 'flip', 'cube', 'swipe',
];

export function TransitionSelectWithPreview({ value, onChange }: TransitionSelectWithPreviewProps) {
  const [hoveredTransition, setHoveredTransition] = useState<TransitionType | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
      >
        🎬 {value === 'none' ? 'No transition' : value}
      </button>

      {dropdownOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100, minWidth: 160, maxHeight: 300, overflowY: 'auto',
        }}>
          {TRANSITIONS.map(t => (
            <div
              key={t}
              onClick={() => { onChange(t); setDropdownOpen(false); setHoveredTransition(null); }}
              onMouseEnter={e => {
                setHoveredTransition(t);
                const rect = e.currentTarget.getBoundingClientRect();
                setPreviewPos({ x: rect.right + 8, y: rect.top - 20 });
              }}
              onMouseLeave={() => setHoveredTransition(null)}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                background: t === value ? '#ebf8ff' : 'transparent',
                borderLeft: t === value ? '3px solid #4299e1' : '3px solid transparent',
              }}
            >
              {t === 'none' ? 'No transition' : t}
            </div>
          ))}
        </div>
      )}

      <TransitionPreview
        transition={hoveredTransition || 'none'}
        visible={hoveredTransition !== null && hoveredTransition !== 'none'}
        x={previewPos.x}
        y={previewPos.y}
      />
    </div>
  );
}
