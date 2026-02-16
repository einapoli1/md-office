import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Volume2, VolumeX, Target } from 'lucide-react';
import { countWords } from '../lib/textAnalysis';

type AmbientSound = 'off' | 'rain' | 'coffee' | 'whitenoise' | 'fireplace';

interface Props {
  content: string;
  editor: any;
  onExit: () => void;
}

// Generate brown noise using Web Audio API
function createNoiseGenerator(ctx: AudioContext, type: AmbientSound): { gain: GainNode; stop: () => void } {
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  gain.connect(ctx.destination);

  if (type === 'off') return { gain, stop: () => {} };

  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'whitenoise') {
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  } else {
    // Brown noise base
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  if (type === 'rain') {
    filter.type = 'highpass';
    filter.frequency.value = 800;
  } else if (type === 'coffee') {
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.5;
  } else if (type === 'fireplace') {
    filter.type = 'lowpass';
    filter.frequency.value = 300;
  } else {
    filter.type = 'allpass';
  }

  source.connect(filter);
  filter.connect(gain);
  source.start();

  return { gain, stop: () => { try { source.stop(); } catch {} } };
}

const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;

const FocusMode: React.FC<Props> = ({ content, editor, onExit }) => {
  const [ambientSound, setAmbientSound] = useState<AmbientSound>('off');
  const [wordGoal, setWordGoal] = useState<number>(0);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(POMODORO_WORK);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroIsBreak, setPomodoroIsBreak] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<{ gain: GainNode; stop: () => void } | null>(null);
  const initialWordsRef = useRef(countWords(content));
  const currentWords = countWords(content);
  const wordsWritten = Math.max(0, currentWords - initialWordsRef.current);

  // Escape key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);

  // Ambient sound
  useEffect(() => {
    if (ambientSound === 'off') {
      if (noiseRef.current) { noiseRef.current.stop(); noiseRef.current = null; }
      return;
    }
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (noiseRef.current) noiseRef.current.stop();
    noiseRef.current = createNoiseGenerator(audioCtxRef.current, ambientSound);
    return () => { if (noiseRef.current) { noiseRef.current.stop(); noiseRef.current = null; } };
  }, [ambientSound]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (noiseRef.current) noiseRef.current.stop();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  // Pomodoro timer
  useEffect(() => {
    if (!pomodoroRunning) return;
    const interval = setInterval(() => {
      setPomodoroTime(prev => {
        if (prev <= 1) {
          setPomodoroRunning(false);
          setPomodoroIsBreak(b => {
            const next = !b;
            setPomodoroTime(next ? POMODORO_BREAK : POMODORO_WORK);
            // Subtle notification
            if (Notification.permission === 'granted') {
              new Notification(next ? 'Time for a break!' : 'Break over — back to work!');
            }
            return next;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomodoroRunning]);

  const formatTimer = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const goalProgress = wordGoal > 0 ? Math.min(wordsWritten / wordGoal, 1) : 0;

  // Apply typewriter focus effect via CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'focus-mode-styles';
    style.textContent = `
      .focus-mode-overlay .ProseMirror > * { opacity: 0.3; transition: opacity 0.3s; }
      .focus-mode-overlay .ProseMirror > *:focus-within,
      .focus-mode-overlay .ProseMirror > *.active-paragraph { opacity: 1; }
    `;
    document.head.appendChild(style);

    // Track cursor position to highlight current paragraph
    const updateActive = () => {
      if (!editor) return;
      const { $from } = editor.state.selection;
      const pos = $from.before(1);
      const dom = editor.view.domAtPos(pos);
      const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
      const proseMirror = el?.closest('.ProseMirror');
      if (proseMirror) {
        proseMirror.querySelectorAll('.active-paragraph').forEach((n: Element) => n.classList.remove('active-paragraph'));
        const block = el?.closest('.ProseMirror > *');
        if (block) block.classList.add('active-paragraph');
      }
    };

    if (editor) {
      editor.on('selectionUpdate', updateActive);
      updateActive();
    }

    return () => {
      document.getElementById('focus-mode-styles')?.remove();
      if (editor) editor.off('selectionUpdate', updateActive);
      document.querySelectorAll('.active-paragraph').forEach(n => n.classList.remove('active-paragraph'));
    };
  }, [editor]);

  return (
    <div className="focus-mode-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg-primary, #fff)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Close button */}
      <button onClick={onExit} style={{
        position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
        cursor: 'pointer', opacity: 0.4, padding: 8, borderRadius: 4,
        color: 'var(--text-primary, #333)',
      }} title="Exit Focus Mode (Esc)">
        <X size={20} />
      </button>

      {/* Editor area — the actual editor is rendered behind, we just overlay controls */}
      <div style={{ flex: 1, width: '100%', maxWidth: 700, margin: '60px auto 0', padding: '0 24px', overflowY: 'auto' }}>
        {/* The editor itself is rendered by the parent — this overlay just adds controls */}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
        padding: '12px 24px', background: 'var(--bg-primary, #fff)', borderTop: '1px solid var(--border-color, #e0e0e0)',
        fontSize: 13, color: 'var(--text-secondary, #666)', opacity: 0.8,
      }}>
        {/* Ambient sound */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {ambientSound === 'off' ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <select value={ambientSound} onChange={e => setAmbientSound(e.target.value as AmbientSound)}
            style={{ background: 'transparent', border: 'none', fontSize: 13, color: 'inherit', cursor: 'pointer' }}>
            <option value="off">Sound: Off</option>
            <option value="rain">Rain</option>
            <option value="coffee">Coffee Shop</option>
            <option value="whitenoise">White Noise</option>
            <option value="fireplace">Fireplace</option>
          </select>
        </div>

        {/* Pomodoro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 14, color: pomodoroIsBreak ? '#4caf50' : 'inherit' }}>
            {pomodoroIsBreak ? '☕ ' : ''}{formatTimer(pomodoroTime)}
          </span>
          <button onClick={() => {
            if (!pomodoroRunning && Notification.permission === 'default') Notification.requestPermission();
            setPomodoroRunning(!pomodoroRunning);
          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
            {pomodoroRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button onClick={() => { setPomodoroTime(POMODORO_WORK); setPomodoroRunning(false); setPomodoroIsBreak(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Word goal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={14} />
          {showGoalInput ? (
            <input type="number" placeholder="Word goal" autoFocus
              style={{ width: 70, fontSize: 13, border: '1px solid var(--border-color, #ccc)', borderRadius: 3, padding: '1px 4px' }}
              onKeyDown={e => { if (e.key === 'Enter') { setWordGoal(Number((e.target as HTMLInputElement).value)); setShowGoalInput(false); } }}
              onBlur={e => { setWordGoal(Number(e.target.value)); setShowGoalInput(false); }}
            />
          ) : (
            <span style={{ cursor: 'pointer' }} onClick={() => setShowGoalInput(true)}>
              {wordGoal > 0 ? `${wordsWritten}/${wordGoal}` : 'Set goal'}
            </span>
          )}
        </div>

        {/* Word count */}
        <span>{currentWords.toLocaleString()} words</span>
      </div>

      {/* Goal progress bar */}
      {wordGoal > 0 && (
        <div style={{
          position: 'absolute', bottom: 46, left: 0, right: 0, height: 3,
          background: 'var(--border-color, #e0e0e0)',
        }}>
          <div style={{
            height: '100%', width: `${goalProgress * 100}%`,
            background: goalProgress >= 1 ? '#4caf50' : 'var(--accent-color, #4285f4)',
            transition: 'width 0.3s',
          }} />
        </div>
      )}
    </div>
  );
};

export default FocusMode;
