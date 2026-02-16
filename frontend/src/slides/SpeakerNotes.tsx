import { useState, useEffect, useRef, useCallback } from 'react';
import { Slide } from './slideModel';
import { SlideTheme } from './slideThemes';
import SlideCanvas from './SlideCanvas';

interface Props {
  slides: Slide[];
  currentIndex: number;
  theme: SlideTheme;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export default function SpeakerNotes({ slides, currentIndex, theme, notes, onNotesChange }: Props) {
  const [fontSize, setFontSize] = useState(16);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const startRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const editorRef = useRef<HTMLDivElement>(null);

  // Timer logic
  const startTimer = useCallback(() => {
    if (running) return;
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(offsetRef.current + Math.floor((Date.now() - startRef.current) / 1000));
    }, 200);
    setRunning(true);
  }, [running]);

  const pauseTimer = useCallback(() => {
    if (!running) return;
    clearInterval(timerRef.current);
    offsetRef.current = elapsed;
    setRunning(false);
  }, [running, elapsed]);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setRunning(false);
    setElapsed(0);
    offsetRef.current = 0;
    setLaps([]);
  }, []);

  const lapTimer = useCallback(() => {
    setLaps(prev => [...prev, elapsed]);
  }, [elapsed]);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Rich text commands
  const execCmd = useCallback((cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onNotesChange(editorRef.current.innerHTML);
    }
  }, [onNotesChange]);

  // Set content when notes change externally (slide switch)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== notes) {
      editorRef.current.innerHTML = notes;
    }
  }, [notes]);

  const nextSlide = currentIndex < slides.length - 1 ? slides[currentIndex + 1] : null;

  return (
    <div className="speaker-notes-enhanced">
      {/* Timer */}
      <div className="speaker-timer-bar">
        <span className="speaker-timer-display">{fmt(elapsed)}</span>
        <div className="speaker-timer-btns">
          {!running ? (
            <button onClick={startTimer} className="btn-sm btn-primary">▶</button>
          ) : (
            <button onClick={pauseTimer} className="btn-sm btn-secondary">⏸</button>
          )}
          <button onClick={lapTimer} className="btn-sm btn-secondary" disabled={!running}>Lap</button>
          <button onClick={resetTimer} className="btn-sm btn-secondary">Reset</button>
        </div>
        {laps.length > 0 && (
          <div className="speaker-laps">
            {laps.map((l, i) => (
              <span key={i} className="speaker-lap-badge">
                {i > 0 ? `+${fmt(l - laps[i - 1])}` : fmt(l)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Rich text editor */}
      <div className="speaker-notes-toolbar">
        <button onClick={() => execCmd('bold')} title="Bold"><b>B</b></button>
        <button onClick={() => execCmd('italic')} title="Italic"><i>I</i></button>
        <button onClick={() => execCmd('underline')} title="Underline"><u>U</u></button>
        <span className="speaker-font-size">
          <button onClick={() => setFontSize(s => Math.max(10, s - 2))}>A-</button>
          <span>{fontSize}px</span>
          <button onClick={() => setFontSize(s => Math.min(32, s + 2))}>A+</button>
        </span>
      </div>
      <div
        ref={editorRef}
        className="speaker-notes-editor"
        contentEditable
        suppressContentEditableWarning
        style={{ fontSize }}
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: notes }}
      />

      {/* Next slide preview */}
      <div className="speaker-next-preview">
        <h5>Next Slide</h5>
        {nextSlide ? (
          <div className="speaker-next-canvas">
            <SlideCanvas slide={nextSlide} theme={theme} scale={0.25} />
          </div>
        ) : (
          <div className="speaker-end">End of presentation</div>
        )}
      </div>
    </div>
  );
}
