import { useState, useEffect, useCallback, useRef } from 'react';
import { Slide, TransitionType } from './slideModel';
import { SlideTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';

interface Props {
  slides: Slide[];
  theme: SlideTheme;
  startIndex?: number;
  onExit: () => void;
  autoAdvance?: boolean;
}

export default function SlideshowView({ slides, theme, startIndex = 0, onExit, autoAdvance = false }: Props) {
  const [current, setCurrent] = useState(startIndex);
  const [fragmentIndex, setFragmentIndex] = useState(-1); // -1 = no fragments revealed
  const [transition, setTransition] = useState<TransitionType>('none');
  const [transitionDuration, setTransitionDuration] = useState('0.3s');
  const [animating, setAnimating] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0); // 0-100 percent
  const containerRef = useRef<HTMLDivElement>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval>>();

  const currentSlide = slides[current];
  const totalFragments = currentSlide?.fragments?.length ?? 0;

  const go = useCallback((dir: number) => {
    if (dir > 0) {
      // Forward: reveal next fragment first, then advance slide
      if (fragmentIndex < totalFragments - 1) {
        setFragmentIndex(f => f + 1);
        return;
      }
      const next = current + 1;
      if (next >= slides.length) return;
      const dur = currentSlide?.transitionDuration || '0.3s';
      setTransition(currentSlide?.transition || 'none');
      setTransitionDuration(dur);
      setAnimating(true);
      const ms = parseFloat(dur) * 1000;
      setTimeout(() => {
        setCurrent(next);
        setFragmentIndex(-1);
        setAnimating(false);
        try { new BroadcastChannel('md-slides').postMessage({ type: 'navigate', index: next }); } catch (_e) { /* noop */ }
      }, ms);
    } else {
      // Backward: hide last fragment first, then go back
      if (fragmentIndex >= 0) {
        setFragmentIndex(f => f - 1);
        return;
      }
      const next = current - 1;
      if (next < 0) return;
      setCurrent(next);
      // Show all fragments on previous slide
      const prevFrags = slides[next]?.fragments?.length ?? 0;
      setFragmentIndex(prevFrags - 1);
      try { new BroadcastChannel('md-slides').postMessage({ type: 'navigate', index: next }); } catch (_e) { /* noop */ }
    }
  }, [current, slides, fragmentIndex, totalFragments, currentSlide]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, onExit]);

  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    return () => { document.exitFullscreen?.().catch(() => {}); };
  }, []);

  // Auto-advance
  useEffect(() => {
    if (!autoAdvance) return;
    const timing = slides[current]?.timingMs;
    if (!timing || timing <= 0) return;
    const startTime = Date.now();
    autoTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / timing) * 100);
      setAutoProgress(pct);
      if (elapsed >= timing) {
        clearInterval(autoTimerRef.current);
        go(1);
      }
    }, 50);
    return () => { clearInterval(autoTimerRef.current); setAutoProgress(0); };
  }, [current, autoAdvance, slides, go]);

  const transClass = animating ? `slideshow-trans-${transition}` : '';
  const showProgressBar = autoAdvance && (slides[current]?.timingMs ?? 0) > 0;

  return (
    <div ref={containerRef} className="slideshow-view" onClick={() => go(1)}>
      <div
        className={`slideshow-slide ${transClass}`}
        style={{ '--trans-duration': transitionDuration } as React.CSSProperties}
      >
        <SlideCanvas
          slide={currentSlide}
          theme={theme}
          className="slideshow-canvas"
          fragmentIndex={fragmentIndex}
        />
      </div>
      {showProgressBar && (
        <div className="slideshow-progress-bar">
          <div className="slideshow-progress-fill" style={{ width: `${autoProgress}%` }} />
        </div>
      )}
    </div>
  );
}
