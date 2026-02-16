import { useState, useCallback, useRef, useEffect } from 'react';

export interface DashboardLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
}

export interface DashboardConfig {
  enabled: boolean;
  backgroundColor: string;
  labels: DashboardLabel[];
}

export function createDashboardConfig(): DashboardConfig {
  return { enabled: false, backgroundColor: '#f5f5f5', labels: [] };
}

interface DashboardToolbarProps {
  config: DashboardConfig;
  onToggle: () => void;
  onBackgroundChange: (color: string) => void;
  onAddLabel: () => void;
  onFullscreen: () => void;
}

export function DashboardToolbar({ config, onToggle, onBackgroundChange, onAddLabel, onFullscreen }: DashboardToolbarProps) {
  if (!config.enabled) {
    return (
      <button className="sheet-tb-btn" onClick={onToggle} title="Dashboard Mode" style={{ fontSize: 11 }}>
        📐 Dashboard
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: '#e8f0fe', borderRadius: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#1a73e8' }}>📐 Dashboard Mode</span>
      <input
        type="color"
        value={config.backgroundColor}
        onChange={e => onBackgroundChange(e.target.value)}
        title="Background color"
        style={{ width: 24, height: 20, border: 'none', cursor: 'pointer' }}
      />
      <button onClick={onAddLabel} style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #ccc', borderRadius: 3, background: '#fff', cursor: 'pointer' }}>+ Label</button>
      <button onClick={onFullscreen} style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #ccc', borderRadius: 3, background: '#fff', cursor: 'pointer' }}>⛶ Present</button>
      <button onClick={onToggle} style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #e74c3c', borderRadius: 3, background: '#fff', color: '#e74c3c', cursor: 'pointer' }}>Exit</button>
    </div>
  );
}

interface DashboardLabelOverlayProps {
  label: DashboardLabel;
  onUpdate: (id: string, updates: Partial<DashboardLabel>) => void;
  onDelete: (id: string) => void;
}

export function DashboardLabelOverlay({ label, onUpdate, onDelete }: DashboardLabelOverlayProps) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: label.x, cy: label.y };
  }, [label.x, label.y, editing]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      // Snap to 10px grid
      const newX = Math.round((dragStart.current.cx + dx) / 10) * 10;
      const newY = Math.round((dragStart.current.cy + dy) / 10) * 10;
      onUpdate(label.id, { x: newX, y: newY });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging, label.id, onUpdate]);

  return (
    <div
      style={{
        position: 'absolute', left: label.x, top: label.y,
        cursor: dragging ? 'grabbing' : 'grab', zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 4,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <input
          autoFocus
          value={label.text}
          onChange={e => onUpdate(label.id, { text: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
          style={{ fontSize: label.fontSize, fontWeight: label.bold ? 'bold' : 'normal', color: label.color, border: '1px solid #4285F4', borderRadius: 2, padding: '2px 4px', background: 'rgba(255,255,255,0.9)' }}
        />
      ) : (
        <span style={{ fontSize: label.fontSize, fontWeight: label.bold ? 'bold' : 'normal', color: label.color, userSelect: 'none' }}>
          {label.text || 'Double-click to edit'}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(label.id); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999', opacity: 0.6 }}
      >✕</button>
    </div>
  );
}

// Fullscreen presentation overlay
interface DashboardPresentationProps {
  backgroundColor: string;
  onExit: () => void;
  children: React.ReactNode;
}

export function DashboardPresentation({ backgroundColor, onExit, children }: DashboardPresentationProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: backgroundColor, zIndex: 3000,
      overflow: 'auto',
    }}>
      <button
        onClick={onExit}
        style={{ position: 'fixed', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', zIndex: 3001, fontSize: 12 }}
      >
        ESC to exit
      </button>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}
