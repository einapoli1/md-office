import { useState, useCallback, useRef } from 'react';

export type AnimTrigger = 'on-click' | 'with-previous' | 'after-previous';
export type AnimCategory = 'entrance' | 'emphasis' | 'exit';

export interface AnimationDef {
  name: string;
  label: string;
  category: AnimCategory;
  css: string; // keyframe name
}

export const ANIMATION_DEFS: AnimationDef[] = [
  // Entrance
  { name: 'fade-in', label: 'Fade In', category: 'entrance', css: 'anim-fade-in' },
  { name: 'fly-in-left', label: 'Fly In Left', category: 'entrance', css: 'anim-fly-in-left' },
  { name: 'fly-in-right', label: 'Fly In Right', category: 'entrance', css: 'anim-fly-in-right' },
  { name: 'fly-in-top', label: 'Fly In Top', category: 'entrance', css: 'anim-fly-in-top' },
  { name: 'fly-in-bottom', label: 'Fly In Bottom', category: 'entrance', css: 'anim-fly-in-bottom' },
  { name: 'zoom-in', label: 'Zoom In', category: 'entrance', css: 'anim-zoom-in' },
  { name: 'bounce', label: 'Bounce', category: 'entrance', css: 'anim-bounce' },
  { name: 'typewriter', label: 'Typewriter', category: 'entrance', css: 'anim-typewriter' },
  // Emphasis
  { name: 'pulse', label: 'Pulse', category: 'emphasis', css: 'anim-pulse' },
  { name: 'shake', label: 'Shake', category: 'emphasis', css: 'anim-shake' },
  { name: 'spin', label: 'Spin', category: 'emphasis', css: 'anim-spin' },
  { name: 'grow-shrink', label: 'Grow/Shrink', category: 'emphasis', css: 'anim-grow-shrink' },
  { name: 'color-change', label: 'Color Change', category: 'emphasis', css: 'anim-color-change' },
  // Exit
  { name: 'fade-out', label: 'Fade Out', category: 'exit', css: 'anim-fade-out' },
  { name: 'fly-out', label: 'Fly Out', category: 'exit', css: 'anim-fly-out' },
  { name: 'zoom-out', label: 'Zoom Out', category: 'exit', css: 'anim-zoom-out' },
  { name: 'collapse', label: 'Collapse', category: 'exit', css: 'anim-collapse' },
];

export interface SlideAnimation {
  id: string;
  elementId: string;
  elementLabel: string;
  animationName: string;
  category: AnimCategory;
  duration: number; // ms
  delay: number; // ms
  trigger: AnimTrigger;
  order: number;
}

interface Props {
  animations: SlideAnimation[];
  onChange: (animations: SlideAnimation[]) => void;
  onPreview: (animations: SlideAnimation[]) => void;
}

const CATEGORY_COLORS: Record<AnimCategory, string> = {
  entrance: '#34a853',
  emphasis: '#fbbc04',
  exit: '#ea4335',
};

export default function AnimationTimeline({ animations, onChange, onPreview }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const sorted = [...animations].sort((a, b) => a.order - b.order);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const updated = reordered.map((a, i) => ({ ...a, order: i }));
    onChange(updated);
    setDragIdx(targetIdx);
  }, [dragIdx, sorted, onChange]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
  }, []);

  const updateAnim = useCallback((id: string, patch: Partial<SlideAnimation>) => {
    const updated = animations.map(a => a.id === id ? { ...a, ...patch } : a);
    onChange(updated);
  }, [animations, onChange]);

  const removeAnim = useCallback((id: string) => {
    onChange(animations.filter(a => a.id !== id));
    if (selected === id) setSelected(null);
  }, [animations, onChange, selected]);

  const addAnimation = useCallback(() => {
    const newAnim: SlideAnimation = {
      id: `anim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      elementId: '',
      elementLabel: `Element ${animations.length + 1}`,
      animationName: 'fade-in',
      category: 'entrance',
      duration: 500,
      delay: 0,
      trigger: 'on-click',
      order: animations.length,
    };
    onChange([...animations, newAnim]);
    setSelected(newAnim.id);
  }, [animations, onChange]);

  const selectedAnim = animations.find(a => a.id === selected);
  const maxTime = Math.max(2000, ...sorted.map(a => a.delay + a.duration));

  return (
    <div className="animation-timeline">
      <div className="anim-timeline-header">
        <h4>🎬 Animation Timeline</h4>
        <div className="anim-timeline-actions">
          <button className="btn-sm btn-secondary" onClick={addAnimation}>+ Add</button>
          <button className="btn-sm btn-primary" onClick={() => onPreview(sorted)}>▶ Preview</button>
        </div>
      </div>

      <div className="anim-timeline-tracks" ref={timelineRef}>
        {sorted.length === 0 && (
          <div className="anim-timeline-empty">No animations. Click "+ Add" to create one.</div>
        )}
        {sorted.map((anim, idx) => {
          const left = (anim.delay / maxTime) * 100;
          const width = Math.max(2, (anim.duration / maxTime) * 100);
          const def = ANIMATION_DEFS.find(d => d.name === anim.animationName);
          const color = CATEGORY_COLORS[anim.category];

          return (
            <div
              key={anim.id}
              className={`anim-track ${selected === anim.id ? 'anim-track-selected' : ''}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => setSelected(anim.id)}
            >
              <span className="anim-track-label">{anim.elementLabel}</span>
              <div className="anim-track-bar-container">
                <div
                  className="anim-track-bar"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: color,
                  }}
                  title={`${def?.label || anim.animationName} (${anim.duration}ms, delay ${anim.delay}ms)`}
                >
                  <span className="anim-bar-text">{def?.label || anim.animationName}</span>
                </div>
              </div>
              <span className="anim-track-trigger">{anim.trigger === 'on-click' ? '🖱' : anim.trigger === 'with-previous' ? '⇶' : '↩'}</span>
            </div>
          );
        })}
      </div>

      {selectedAnim && (
        <div className="anim-properties">
          <div className="anim-prop-row">
            <label>Element</label>
            <input
              type="text"
              value={selectedAnim.elementLabel}
              onChange={e => updateAnim(selectedAnim.id, { elementLabel: e.target.value })}
            />
          </div>
          <div className="anim-prop-row">
            <label>Animation</label>
            <select
              value={selectedAnim.animationName}
              onChange={e => {
                const def = ANIMATION_DEFS.find(d => d.name === e.target.value);
                updateAnim(selectedAnim.id, {
                  animationName: e.target.value,
                  category: def?.category || 'entrance',
                });
              }}
            >
              <optgroup label="Entrance">
                {ANIMATION_DEFS.filter(d => d.category === 'entrance').map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Emphasis">
                {ANIMATION_DEFS.filter(d => d.category === 'emphasis').map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Exit">
                {ANIMATION_DEFS.filter(d => d.category === 'exit').map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="anim-prop-row">
            <label>Duration (ms)</label>
            <input
              type="number"
              min={100}
              step={100}
              value={selectedAnim.duration}
              onChange={e => updateAnim(selectedAnim.id, { duration: parseInt(e.target.value) || 500 })}
            />
          </div>
          <div className="anim-prop-row">
            <label>Delay (ms)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={selectedAnim.delay}
              onChange={e => updateAnim(selectedAnim.id, { delay: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="anim-prop-row">
            <label>Trigger</label>
            <select
              value={selectedAnim.trigger}
              onChange={e => updateAnim(selectedAnim.id, { trigger: e.target.value as AnimTrigger })}
            >
              <option value="on-click">On Click</option>
              <option value="with-previous">With Previous</option>
              <option value="after-previous">After Previous</option>
            </select>
          </div>
          <button className="btn-sm btn-danger" onClick={() => removeAnim(selectedAnim.id)} style={{ marginTop: 8 }}>
            🗑 Remove
          </button>
        </div>
      )}
    </div>
  );
}
