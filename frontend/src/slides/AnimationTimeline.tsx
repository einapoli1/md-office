import { useState, useCallback, useRef, useEffect } from 'react';

export type AnimTrigger = 'on-click' | 'with-previous' | 'after-previous';
export type AnimCategory = 'entrance' | 'emphasis' | 'exit';

export interface AnimationDef {
  name: string;
  label: string;
  category: AnimCategory;
  css: string;
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
  groupId?: string; // group animations together
}

export interface AnimationGroup {
  id: string;
  label: string;
  animationIds: string[];
}

interface Props {
  animations: SlideAnimation[];
  groups?: AnimationGroup[];
  onChange: (animations: SlideAnimation[]) => void;
  onGroupsChange?: (groups: AnimationGroup[]) => void;
  onPreview: (animations: SlideAnimation[]) => void;
  onPreviewSingle?: (animation: SlideAnimation) => void;
}

const CATEGORY_COLORS: Record<AnimCategory, string> = {
  entrance: '#34a853',
  emphasis: '#fbbc04',
  exit: '#ea4335',
};

const TRIGGER_ICONS: Record<AnimTrigger, { icon: string; label: string }> = {
  'on-click': { icon: '🖱', label: 'On Click' },
  'with-previous': { icon: '⇶', label: 'With Previous' },
  'after-previous': { icon: '↩', label: 'After Previous' },
};

export default function AnimationTimeline({ animations, groups = [], onChange, onGroupsChange, onPreview, onPreviewSingle }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(-1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playTimerRef = useRef<number | null>(null);

  const sorted = [...animations].sort((a, b) => a.order - b.order);

  // Cleanup play timer
  useEffect(() => {
    return () => { if (playTimerRef.current) clearTimeout(playTimerRef.current); };
  }, []);

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

  const duplicateAnim = useCallback((anim: SlideAnimation) => {
    const dup: SlideAnimation = {
      ...anim,
      id: `anim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      order: animations.length,
    };
    onChange([...animations, dup]);
    setSelected(dup.id);
  }, [animations, onChange]);

  // Group selected animations
  const groupSelected = useCallback(() => {
    if (!onGroupsChange) return;
    // Simple: group the selected animation with the next one
    const sel = sorted.find(a => a.id === selected);
    if (!sel) return;
    const groupId = `group-${Date.now()}`;
    const newGroup: AnimationGroup = { id: groupId, label: `Group ${groups.length + 1}`, animationIds: [sel.id] };
    const updated = animations.map(a => a.id === sel.id ? { ...a, groupId } : a);
    onChange(updated);
    onGroupsChange([...groups, newGroup]);
  }, [selected, sorted, animations, groups, onChange, onGroupsChange]);

  // Sequential preview
  const playAll = useCallback(() => {
    if (sorted.length === 0) return;
    setIsPlaying(true);
    setPlayingIdx(0);
    onPreview(sorted);

    let idx = 0;
    const playNext = () => {
      if (idx >= sorted.length) {
        setIsPlaying(false);
        setPlayingIdx(-1);
        return;
      }
      setPlayingIdx(idx);
      const anim = sorted[idx];
      const totalTime = anim.delay + anim.duration + 100;
      idx++;
      playTimerRef.current = window.setTimeout(playNext, totalTime);
    };
    playNext();
  }, [sorted, onPreview]);

  const stopPreview = useCallback(() => {
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    setIsPlaying(false);
    setPlayingIdx(-1);
  }, []);

  const selectedAnim = animations.find(a => a.id === selected);
  const maxTime = Math.max(2000, ...sorted.map(a => a.delay + a.duration));

  return (
    <div className="animation-timeline">
      <div className="anim-timeline-header">
        <h4>🎬 Animation Timeline</h4>
        <div className="anim-timeline-actions">
          <button className="btn-sm btn-secondary" onClick={addAnimation}>+ Add</button>
          {isPlaying ? (
            <button className="btn-sm btn-danger" onClick={stopPreview}>⏹ Stop</button>
          ) : (
            <button className="btn-sm btn-primary" onClick={playAll} disabled={sorted.length === 0}>▶ Preview All</button>
          )}
        </div>
      </div>

      <div className="anim-timeline-tracks" ref={timelineRef}>
        {sorted.length === 0 && (
          <div className="anim-timeline-empty">No animations. Click "+ Add" to create one.</div>
        )}
        {sorted.map((anim, idx) => {
          const left = (anim.delay / maxTime) * 100;
          const width = Math.max(3, (anim.duration / maxTime) * 100);
          const def = ANIMATION_DEFS.find(d => d.name === anim.animationName);
          const color = CATEGORY_COLORS[anim.category];
          const isActive = playingIdx === idx;
          const trigger = TRIGGER_ICONS[anim.trigger];

          return (
            <div
              key={anim.id}
              className={`anim-track ${selected === anim.id ? 'anim-track-selected' : ''} ${isActive ? 'anim-track-playing' : ''}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => setSelected(anim.id)}
              onDoubleClick={() => onPreviewSingle?.(anim)}
            >
              <span className="anim-track-order">{idx + 1}</span>
              <span className="anim-track-label" title={anim.elementLabel}>{anim.elementLabel}</span>
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
                {isActive && <div className="anim-playhead" style={{ left: `${left}%`, width: `${width}%` }} />}
              </div>
              <span className="anim-track-trigger" title={trigger.label}>{trigger.icon}</span>
              {anim.groupId && <span className="anim-group-badge" title="Grouped">G</span>}
            </div>
          );
        })}
      </div>

      {/* Time ruler */}
      {sorted.length > 0 && (
        <div className="anim-time-ruler">
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <span key={pct} className="anim-time-mark" style={{ left: `${pct * 100}%` }}>
              {Math.round(pct * maxTime)}ms
            </span>
          ))}
        </div>
      )}

      {selectedAnim && (
        <div className="anim-properties">
          <div className="anim-props-header">
            <span className="anim-props-title">Properties</span>
            <div className="anim-props-actions">
              <button className="btn-sm btn-secondary" onClick={() => duplicateAnim(selectedAnim)} title="Duplicate">📋</button>
              {onGroupsChange && (
                <button className="btn-sm btn-secondary" onClick={groupSelected} title="Create group">🔗</button>
              )}
              <button className="btn-sm btn-danger" onClick={() => removeAnim(selectedAnim.id)} title="Remove">🗑</button>
            </div>
          </div>
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
              <optgroup label="🟢 Entrance">
                {ANIMATION_DEFS.filter(d => d.category === 'entrance').map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="🟡 Emphasis">
                {ANIMATION_DEFS.filter(d => d.category === 'emphasis').map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="🔴 Exit">
                {ANIMATION_DEFS.filter(d => d.category === 'exit').map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="anim-prop-row-inline">
            <div className="anim-prop-row">
              <label>Duration</label>
              <div className="anim-input-with-unit">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={selectedAnim.duration}
                  onChange={e => updateAnim(selectedAnim.id, { duration: parseInt(e.target.value) || 500 })}
                />
                <span>ms</span>
              </div>
            </div>
            <div className="anim-prop-row">
              <label>Delay</label>
              <div className="anim-input-with-unit">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={selectedAnim.delay}
                  onChange={e => updateAnim(selectedAnim.id, { delay: parseInt(e.target.value) || 0 })}
                />
                <span>ms</span>
              </div>
            </div>
          </div>
          <div className="anim-prop-row">
            <label>Trigger</label>
            <div className="anim-trigger-btns">
              {(['on-click', 'with-previous', 'after-previous'] as AnimTrigger[]).map(t => (
                <button
                  key={t}
                  className={`anim-trigger-btn ${selectedAnim.trigger === t ? 'active' : ''}`}
                  onClick={() => updateAnim(selectedAnim.id, { trigger: t })}
                >
                  {TRIGGER_ICONS[t].icon} {TRIGGER_ICONS[t].label}
                </button>
              ))}
            </div>
          </div>
          {onPreviewSingle && (
            <button className="btn-sm btn-primary" style={{ marginTop: 8, width: '100%' }} onClick={() => onPreviewSingle(selectedAnim)}>
              ▶ Preview This Animation
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Badge component to show animation order on slide elements */
export function AnimationOrderBadge({ order, category }: { order: number; category: AnimCategory }) {
  return (
    <span className="anim-order-badge" style={{ backgroundColor: CATEGORY_COLORS[category] }}>
      {order + 1}
    </span>
  );
}
