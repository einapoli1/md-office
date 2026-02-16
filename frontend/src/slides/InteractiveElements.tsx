import { useState, useCallback } from 'react';

export type InteractiveElementType = 'button' | 'hotspot' | 'quiz' | 'poll';

export interface SlideButton {
  id: string;
  type: 'button';
  label: string;
  action: 'navigate' | 'url' | 'animation';
  target: string; // slide index, URL, or animation name
  x: number; y: number; width: number; height: number;
  style: 'primary' | 'secondary' | 'outline';
}

export interface SlideHotspot {
  id: string;
  type: 'hotspot';
  tooltip: string;
  action: 'tooltip' | 'navigate';
  target: string;
  x: number; y: number; width: number; height: number;
}

export interface SlideQuiz {
  id: string;
  type: 'quiz';
  question: string;
  options: string[];
  correctIndex: number;
  x: number; y: number; width: number; height: number;
}

export interface SlidePoll {
  id: string;
  type: 'poll';
  question: string;
  options: string[];
  results: number[]; // vote counts
  x: number; y: number; width: number; height: number;
}

export type InteractiveElement = SlideButton | SlideHotspot | SlideQuiz | SlidePoll;

export function genInteractiveId(): string {
  return `interactive-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Dialog to insert an interactive element */
interface InsertInteractiveDialogProps {
  onInsert: (element: InteractiveElement) => void;
  onClose: () => void;
  totalSlides: number;
}

export function InsertInteractiveDialog({ onInsert, onClose, totalSlides }: InsertInteractiveDialogProps) {
  const [elementType, setElementType] = useState<InteractiveElementType>('button');
  const [label, setLabel] = useState('Click Me');
  const [action, setAction] = useState<'navigate' | 'url' | 'animation' | 'tooltip'>('navigate');
  const [target, setTarget] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['Option A', 'Option B', 'Option C', 'Option D']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [tooltip, setTooltip] = useState('');
  const [pollResults, setPollResults] = useState([25, 40, 20, 15]);

  const handleInsert = useCallback(() => {
    const base = { x: 20, y: 20, width: 60, height: 40 };
    switch (elementType) {
      case 'button':
        onInsert({
          id: genInteractiveId(), type: 'button', label, action: action as 'navigate' | 'url' | 'animation',
          target, ...base, height: 10, width: 30, style: 'primary',
        });
        break;
      case 'hotspot':
        onInsert({
          id: genInteractiveId(), type: 'hotspot', tooltip,
          action: action === 'navigate' ? 'navigate' : 'tooltip',
          target, ...base, width: 20, height: 20,
        });
        break;
      case 'quiz':
        onInsert({
          id: genInteractiveId(), type: 'quiz', question,
          options: options.filter(o => o.trim()), correctIndex, ...base,
        });
        break;
      case 'poll':
        onInsert({
          id: genInteractiveId(), type: 'poll', question,
          options: options.filter(o => o.trim()), results: pollResults, ...base,
        });
        break;
    }
  }, [elementType, label, action, target, question, options, correctIndex, tooltip, pollResults, onInsert]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 480, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Insert Interactive Element</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['button', 'hotspot', 'quiz', 'poll'] as const).map(t => (
            <button key={t} className={elementType === t ? 'btn-active' : ''} onClick={() => setElementType(t)}>
              {t === 'button' ? '🔘' : t === 'hotspot' ? '🎯' : t === 'quiz' ? '❓' : '📊'} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {elementType === 'button' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Button label" value={label} onChange={e => setLabel(e.target.value)} style={{ padding: 6 }} />
            <select value={action} onChange={e => setAction(e.target.value as typeof action)} style={{ padding: 6 }}>
              <option value="navigate">Navigate to slide</option>
              <option value="url">Open URL</option>
              <option value="animation">Trigger animation</option>
            </select>
            {action === 'navigate' && (
              <select value={target} onChange={e => setTarget(e.target.value)} style={{ padding: 6 }}>
                <option value="">Select slide…</option>
                {Array.from({ length: totalSlides }, (_, i) => (
                  <option key={i} value={String(i)}>Slide {i + 1}</option>
                ))}
              </select>
            )}
            {action === 'url' && (
              <input placeholder="https://…" value={target} onChange={e => setTarget(e.target.value)} style={{ padding: 6 }} />
            )}
          </div>
        )}

        {elementType === 'hotspot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Tooltip text" value={tooltip} onChange={e => setTooltip(e.target.value)} style={{ padding: 6 }} />
            <select value={action} onChange={e => setAction(e.target.value as typeof action)} style={{ padding: 6 }}>
              <option value="tooltip">Show tooltip</option>
              <option value="navigate">Navigate to slide</option>
            </select>
            {action === 'navigate' && (
              <select value={target} onChange={e => setTarget(e.target.value)} style={{ padding: 6 }}>
                <option value="">Select slide…</option>
                {Array.from({ length: totalSlides }, (_, i) => (
                  <option key={i} value={String(i)}>Slide {i + 1}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {(elementType === 'quiz' || elementType === 'poll') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Question" value={question} onChange={e => setQuestion(e.target.value)} style={{ padding: 6 }} />
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  value={opt}
                  onChange={e => { const a = [...options]; a[i] = e.target.value; setOptions(a); }}
                  style={{ flex: 1, padding: 6 }}
                  placeholder={`Option ${i + 1}`}
                />
                {elementType === 'quiz' && (
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input type="radio" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} /> ✓
                  </label>
                )}
                {elementType === 'poll' && (
                  <input
                    type="number" min={0} value={pollResults[i] || 0}
                    onChange={e => { const r = [...pollResults]; r[i] = parseInt(e.target.value) || 0; setPollResults(r); }}
                    style={{ width: 50, padding: 4 }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleInsert} className="btn-primary">Insert</button>
        </div>
      </div>
    </div>
  );
}

/** Editor view: bordered outlines */
interface InteractiveElementEditorProps {
  element: InteractiveElement;
  onRemove: (id: string) => void;
}

export function InteractiveElementEditor({ element, onRemove }: InteractiveElementEditorProps) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${element.x}%`, top: `${element.y}%`,
    width: `${element.width}%`, height: `${element.height}%`,
    border: '2px dashed',
    borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, overflow: 'hidden',
  };

  const colors: Record<InteractiveElementType, string> = {
    button: '#4299e1', hotspot: '#ed8936', quiz: '#9f7aea', poll: '#48bb78',
  };

  return (
    <div style={{ ...baseStyle, borderColor: colors[element.type] }}>
      <div style={{ color: colors[element.type], textAlign: 'center', padding: 4 }}>
        {element.type === 'button' && `🔘 ${(element as SlideButton).label}`}
        {element.type === 'hotspot' && `🎯 Hotspot`}
        {element.type === 'quiz' && `❓ Quiz`}
        {element.type === 'poll' && `📊 Poll`}
      </div>
      <button
        onClick={() => onRemove(element.id)}
        style={{
          position: 'absolute', top: 2, right: 2, fontSize: 10, padding: '1px 4px',
          background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer',
        }}
      >✕</button>
    </div>
  );
}

/** Slideshow view: fully interactive */
interface InteractiveElementSlideshowProps {
  element: InteractiveElement;
  onNavigate: (slideIndex: number) => void;
}

export function InteractiveElementSlideshow({ element, onNavigate }: InteractiveElementSlideshowProps) {
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState(false);
  const [animatedPoll, setAnimatedPoll] = useState(false);

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${element.x}%`, top: `${element.y}%`,
    width: `${element.width}%`, height: `${element.height}%`,
  };

  if (element.type === 'button') {
    const btn = element as SlideButton;
    return (
      <div style={baseStyle}>
        <button
          onClick={e => {
            e.stopPropagation();
            if (btn.action === 'navigate') onNavigate(parseInt(btn.target));
            else if (btn.action === 'url') window.open(btn.target, '_blank');
          }}
          style={{
            width: '100%', height: '100%', cursor: 'pointer', fontSize: 16, fontWeight: 600,
            background: btn.style === 'primary' ? '#4299e1' : btn.style === 'secondary' ? '#666' : 'transparent',
            color: btn.style === 'outline' ? '#4299e1' : '#fff',
            border: btn.style === 'outline' ? '2px solid #4299e1' : 'none',
            borderRadius: 6,
          }}
        >
          {btn.label}
        </button>
      </div>
    );
  }

  if (element.type === 'hotspot') {
    const hs = element as SlideHotspot;
    return (
      <div
        style={{ ...baseStyle, cursor: 'pointer' }}
        onMouseEnter={() => setHoveredHotspot(true)}
        onMouseLeave={() => setHoveredHotspot(false)}
        onClick={e => {
          e.stopPropagation();
          if (hs.action === 'navigate') onNavigate(parseInt(hs.target));
        }}
      >
        {hoveredHotspot && hs.tooltip && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            background: '#1a202c', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 13,
            whiteSpace: 'nowrap', zIndex: 10,
          }}>
            {hs.tooltip}
          </div>
        )}
      </div>
    );
  }

  if (element.type === 'quiz') {
    const quiz = element as SlideQuiz;
    return (
      <div style={{ ...baseStyle, background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '2%', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{quiz.question}</div>
        {quiz.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => setQuizAnswer(i)}
            style={{
              padding: '6px 10px', marginBottom: 4, borderRadius: 4, border: '1px solid #ccc',
              textAlign: 'left', cursor: 'pointer', fontSize: 13,
              background: quizAnswer === null ? '#f7fafc'
                : i === quiz.correctIndex ? '#c6f6d5'
                : quizAnswer === i ? '#fed7d7' : '#f7fafc',
            }}
          >
            {opt}
          </button>
        ))}
        {quizAnswer !== null && (
          <div style={{ fontSize: 12, marginTop: 4, color: quizAnswer === quiz.correctIndex ? '#38a169' : '#e53e3e' }}>
            {quizAnswer === quiz.correctIndex ? '✓ Correct!' : `✗ Correct answer: ${quiz.options[quiz.correctIndex]}`}
          </div>
        )}
      </div>
    );
  }

  if (element.type === 'poll') {
    const poll = element as SlidePoll;
    const total = poll.results.reduce((a, b) => a + b, 0) || 1;
    // Trigger animation on mount
    if (!animatedPoll) setTimeout(() => setAnimatedPoll(true), 100);
    return (
      <div style={{ ...baseStyle, background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '2%', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{poll.question}</div>
        {poll.options.map((opt, i) => {
          const pct = Math.round((poll.results[i] / total) * 100);
          return (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, marginBottom: 2 }}>{opt} ({pct}%)</div>
              <div style={{ background: '#e2e8f0', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                <div style={{
                  width: animatedPoll ? `${pct}%` : '0%',
                  height: '100%', background: ['#4299e1', '#48bb78', '#ed8936', '#9f7aea'][i % 4],
                  borderRadius: 4, transition: 'width 1s ease-out',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
