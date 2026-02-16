import { useState, useEffect, useRef } from 'react';
import { Slide } from './slideModel';
import { SlideTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';

interface Props {
  slides: Slide[];
  theme: SlideTheme;
  startIndex?: number;
}

/** Renders inside a new window opened by the editor */
export default function PresenterView({ slides, theme, startIndex = 0, qaSessionCode: _qaSessionCode }: Props & { qaSessionCode?: string }) {
  const [current, setCurrent] = useState(startIndex);
  const timerRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    timerRef.current = id;
    return () => clearInterval(id);
  }, []);

  // BroadcastChannel sync
  useEffect(() => {
    const ch = new BroadcastChannel('md-slides');
    ch.onmessage = (e) => {
      if (e.data?.type === 'navigate') setCurrent(e.data.index);
    };
    return () => ch.close();
  }, []);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrent(c => Math.min(c + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrent(c => Math.max(c - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slides.length]);

  // Broadcast back to slideshow
  useEffect(() => {
    try { new BroadcastChannel('md-slides').postMessage({ type: 'navigate', index: current }); } catch (_e) { /* noop */ }
  }, [current]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const nextSlide = current < slides.length - 1 ? slides[current + 1] : null;

  return (
    <div className="presenter-view">
      <div className="presenter-current">
        <SlideCanvas slide={slides[current]} theme={theme} className="presenter-main-canvas" />
      </div>
      <div className="presenter-side">
        <div className="presenter-next">
          <h4>Next</h4>
          {nextSlide ? <SlideCanvas slide={nextSlide} theme={theme} scale={0.3} /> : <div className="presenter-end">End of presentation</div>}
        </div>
        <div className="presenter-notes">
          <h4>Notes</h4>
          <div className="presenter-notes-text">{slides[current]?.notes || '(no notes)'}</div>
        </div>
        <div className="presenter-footer">
          <span className="presenter-counter">{current + 1} / {slides.length}</span>
          <span className="presenter-timer">{fmt(elapsed)}</span>
        </div>
      </div>
    </div>
  );
}

/** Open presenter view in a new window */
export function openPresenterWindow(slides: Slide[], _theme: SlideTheme, currentIndex: number) {
  const win = window.open('', 'presenter', 'width=1200,height=700');
  if (!win) return;
  win.document.title = 'Presenter View';
  win.document.body.innerHTML = '<div id="presenter-root"></div>';
  // We can't easily render React into another window without a bundler trick,
  // so we use BroadcastChannel and a simple HTML-based presenter.
  const style = win.document.createElement('style');
  style.textContent = presenterCSS();
  win.document.head.appendChild(style);

  const root = win.document.getElementById('presenter-root')!;
  let idx = currentIndex;

  function render() {
    const slide = slides[idx];
    const next = idx < slides.length - 1 ? slides[idx + 1] : null;
    root.innerHTML = `
      <div class="pv-layout">
        <div class="pv-current"><div class="pv-slide-content">${slide?.content || ''}</div></div>
        <div class="pv-side">
          <div class="pv-next"><h4>Next</h4><div class="pv-slide-content small">${next?.content || 'End'}</div></div>
          <div class="pv-notes"><h4>Notes</h4><p>${slide?.notes || '(no notes)'}</p></div>
          <div class="pv-info"><span>${idx + 1} / ${slides.length}</span></div>
        </div>
      </div>`;
  }
  render();

  const ch = new BroadcastChannel('md-slides');
  ch.onmessage = (e) => {
    if (e.data?.type === 'navigate') { idx = e.data.index; render(); }
  };
  win.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { idx = Math.min(idx + 1, slides.length - 1); ch.postMessage({ type: 'navigate', index: idx }); render(); }
    if (e.key === 'ArrowLeft') { idx = Math.max(idx - 1, 0); ch.postMessage({ type: 'navigate', index: idx }); render(); }
  });
}

function presenterCSS() {
  return `
    body { margin:0; background:#222; color:#fff; font-family:sans-serif; }
    .pv-layout { display:flex; height:100vh; }
    .pv-current { flex:2; display:flex; align-items:center; justify-content:center; padding:20px; }
    .pv-slide-content { background:#fff; color:#333; padding:40px; border-radius:8px; width:100%; max-height:90vh; overflow:auto; }
    .pv-side { flex:1; display:flex; flex-direction:column; padding:20px; gap:16px; }
    .pv-next { flex:1; }
    .pv-slide-content.small { font-size:10px; padding:12px; }
    .pv-notes { flex:1; overflow:auto; }
    .pv-info { text-align:center; font-size:18px; padding:8px; }
    h4 { margin:0 0 8px; color:#aaa; font-size:12px; text-transform:uppercase; }
  `;
}
