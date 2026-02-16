import { useState, useEffect, useRef, useCallback } from 'react';
import { Slide } from './slideModel';
import { SlideTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';

export interface SlideTimings {
  /** Milliseconds per slide, indexed by slide index */
  perSlide: number[];
  totalMs: number;
}

interface Props {
  slides: Slide[];
  theme: SlideTheme;
  onExit: () => void;
  onSaveTimings: (timings: SlideTimings) => void;
}

export default function RehearsalMode({ slides, theme, onExit, onSaveTimings }: Props) {
  const [current, setCurrent] = useState(0);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timingsRef = useRef<number[]>(new Array(slides.length).fill(0));
  const slideStartRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Timer tick
  useEffect(() => {
    if (!running || finished) return;
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - slideStartRef.current);
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [running, finished]);

  const recordAndAdvance = useCallback((dir: number) => {
    const now = Date.now();
    timingsRef.current[current] += now - slideStartRef.current;

    const next = current + dir;
    if (next >= slides.length) {
      setFinished(true);
      setRunning(false);
      return;
    }
    if (next < 0) return;
    setCurrent(next);
    slideStartRef.current = Date.now();
    setElapsed(0);
  }, [current, slides.length]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight' || e.key === ' ') recordAndAdvance(1);
      else if (e.key === 'ArrowLeft') recordAndAdvance(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [recordAndAdvance, onExit]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const totalMs = timingsRef.current.reduce((a, b) => a + b, 0);
  const suggestedPace = totalMs / slides.length;

  if (finished) {
    return (
      <div className="rehearsal-summary">
        <h2>Rehearsal Summary</h2>
        <table className="rehearsal-table">
          <thead>
            <tr><th>Slide</th><th>Time Spent</th><th>Suggested Pace</th></tr>
          </thead>
          <tbody>
            {timingsRef.current.map((ms, i) => (
              <tr key={i} className={ms > suggestedPace * 1.5 ? 'rehearsal-over' : ''}>
                <td>{i + 1}</td>
                <td>{fmt(ms)}</td>
                <td>{fmt(suggestedPace)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td><strong>Total</strong></td><td><strong>{fmt(totalMs)}</strong></td><td></td></tr>
          </tfoot>
        </table>
        <div className="rehearsal-actions">
          <button className="btn-primary" onClick={() => onSaveTimings({ perSlide: timingsRef.current, totalMs })}>
            💾 Save Timings for Auto-Advance
          </button>
          <button className="btn-secondary" onClick={onExit}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rehearsal-view" onClick={() => recordAndAdvance(1)}>
      <div className="rehearsal-slide">
        <SlideCanvas slide={slides[current]} theme={theme} className="slideshow-canvas" />
      </div>
      <div className="rehearsal-timer-bar">
        <span className="rehearsal-counter">Slide {current + 1} / {slides.length}</span>
        <span className="rehearsal-timer">{fmt(elapsed)}</span>
        <span className="rehearsal-total">Total: {fmt(totalMs + elapsed)}</span>
        <button className="btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onExit(); }}>✕ Exit</button>
      </div>
    </div>
  );
}
