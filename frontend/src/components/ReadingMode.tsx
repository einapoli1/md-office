import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Pause, Type } from 'lucide-react';
import { estimateReadingTime } from '../lib/textAnalysis';

type BgTheme = 'white' | 'sepia' | 'dark';

interface Props {
  content: string; // HTML content
  onExit: () => void;
}

const BG_COLORS: Record<BgTheme, { bg: string; text: string }> = {
  white: { bg: '#ffffff', text: '#222222' },
  sepia: { bg: '#f4ecd8', text: '#5b4636' },
  dark: { bg: '#1a1a2e', text: '#d4d4d4' },
};

const ReadingMode: React.FC<Props> = ({ content, onExit }) => {
  const [fontSerif, setFontSerif] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [bgTheme, setBgTheme] = useState<BgTheme>('white');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [highlights, setHighlights] = useState<{ id: string; text: string; note: string }[]>([]);
  const [showControls, setShowControls] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Strip HTML to plain text for reading time
  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const readingMinutes = estimateReadingTime(plainText);

  // Escape to exit
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);

  // Scroll progress
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setScrollProgress(scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Text-to-speech
  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  }, [isSpeaking, plainText]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => { speechSynthesis.cancel(); };
  }, []);

  // Highlight selected text
  const handleHighlight = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current?.contains(sel.anchorNode)) return;
    const text = sel.toString().trim();
    if (text) {
      setHighlights(prev => [...prev, { id: Date.now().toString(), text, note: '' }]);
      // Wrap selection in highlight span
      try {
        const range = sel.getRangeAt(0);
        const span = document.createElement('mark');
        span.style.background = 'rgba(255, 235, 59, 0.4)';
        span.style.borderRadius = '2px';
        range.surroundContents(span);
      } catch {}
      sel.removeAllRanges();
    }
  }, []);

  const colors = BG_COLORS[bgTheme];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: colors.bg, color: colors.text,
      display: 'flex', flexDirection: 'column', transition: 'background 0.3s, color 0.3s',
    }}>
      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 1 }}>
        <div style={{
          height: '100%', width: `${scrollProgress * 100}%`,
          background: 'var(--accent-color, #4285f4)', transition: 'width 0.1s',
        }} />
      </div>

      {/* Top bar */}
      {showControls && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', fontSize: 13, borderBottom: `1px solid ${bgTheme === 'dark' ? '#333' : '#e0e0e0'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>~{Math.max(1, Math.round(readingMinutes))} min read</span>

            {/* Font toggle */}
            <button onClick={() => setFontSerif(!fontSerif)} title="Toggle font"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14 }}>
              <Type size={14} /> {fontSerif ? 'Serif' : 'Sans'}
            </button>

            {/* Font size */}
            <input type="range" min={14} max={28} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
              style={{ width: 80 }} title={`Font size: ${fontSize}px`} />

            {/* Line spacing */}
            <select value={lineSpacing} onChange={e => setLineSpacing(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 13, cursor: 'pointer' }}>
              <option value={1.4}>Tight</option>
              <option value={1.8}>Normal</option>
              <option value={2.2}>Relaxed</option>
            </select>

            {/* Background */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['white', 'sepia', 'dark'] as BgTheme[]).map(t => (
                <button key={t} onClick={() => setBgTheme(t)} style={{
                  width: 22, height: 22, borderRadius: '50%', border: bgTheme === t ? '2px solid #4285f4' : '1px solid #aaa',
                  background: BG_COLORS[t].bg, cursor: 'pointer',
                }} title={t} />
              ))}
            </div>

            {/* Highlight button */}
            <button onClick={handleHighlight} title="Highlight selection"
              style={{ background: 'rgba(255,235,59,0.3)', border: 'none', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 13, color: 'inherit' }}>
              Highlight
            </button>

            {/* TTS */}
            <button onClick={toggleSpeech} title={isSpeaking ? 'Stop reading' : 'Read aloud'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              {isSpeaking ? <Pause size={14} /> : <Play size={14} />}
              <span style={{ marginLeft: 4, fontSize: 13 }}>{isSpeaking ? 'Stop' : 'Read aloud'}</span>
            </button>
          </div>

          <button onClick={onExit} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 4,
          }} title="Exit Reading Mode (Esc)">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}
        onClick={() => setShowControls(!showControls)}>
        <div ref={contentRef} style={{
          maxWidth: 680, margin: '0 auto',
          fontFamily: fontSerif ? 'Georgia, "Times New Roman", serif' : '-apple-system, Helvetica, Arial, sans-serif',
          fontSize, lineHeight: lineSpacing,
        }} dangerouslySetInnerHTML={{ __html: content }} />
      </div>

      {/* Highlights sidebar (if any) */}
      {highlights.length > 0 && (
        <div style={{
          position: 'absolute', right: 16, top: 60, width: 200, maxHeight: '50vh', overflow: 'auto',
          background: bgTheme === 'dark' ? '#2a2a3e' : '#fff', border: '1px solid #ddd', borderRadius: 8,
          padding: 12, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          color: bgTheme === 'dark' ? '#d4d4d4' : '#333',
        }}>
          <strong style={{ fontSize: 13 }}>Highlights ({highlights.length})</strong>
          {highlights.map(h => (
            <div key={h.id} style={{ marginTop: 8, padding: '4px 0', borderTop: '1px solid #eee' }}>
              <span style={{ background: 'rgba(255,235,59,0.3)', padding: '0 2px' }}>"{h.text.slice(0, 60)}{h.text.length > 60 ? '…' : ''}"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReadingMode;
