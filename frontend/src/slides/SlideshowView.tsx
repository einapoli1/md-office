import { useState, useEffect, useCallback, useRef } from 'react';
import { Slide, TransitionType } from './slideModel';
import { SlideTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';

interface Props {
  slides: Slide[];
  theme: SlideTheme;
  startIndex?: number;
  onExit: () => void;
}

export default function SlideshowView({ slides, theme, startIndex = 0, onExit }: Props) {
  const [current, setCurrent] = useState(startIndex);
  const [transition, setTransition] = useState<TransitionType>('none');
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const go = useCallback((dir: number) => {
    const next = current + dir;
    if (next < 0 || next >= slides.length) return;
    setTransition(slides[current].transition);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(next);
      setAnimating(false);
      // Broadcast to presenter
      try { new BroadcastChannel('md-slides').postMessage({ type: 'navigate', index: next }); } catch (_e) { /* noop */ }
    }, 300);
  }, [current, slides]);

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

  const transClass = animating ? `slideshow-trans-${transition}` : '';

  return (
    <div ref={containerRef} className="slideshow-view" onClick={() => go(1)}>
      <div className={`slideshow-slide ${transClass}`}>
        <SlideCanvas slide={slides[current]} theme={theme} className="slideshow-canvas" />
      </div>
    </div>
  );
}
