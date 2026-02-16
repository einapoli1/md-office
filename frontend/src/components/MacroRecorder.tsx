import { useState, useEffect, useCallback, useRef } from 'react';
// macro save/load used externally via events

interface RecordedAction {
  type: 'insert' | 'delete' | 'replace';
  text?: string;
  position?: number;
  length?: number;
  search?: string;
  replacement?: string;
  timestamp: number;
}

interface MacroRecorderProps {
  onStop: (code: string) => void;
}

export function useMacroRecorder() {
  const [recording, setRecording] = useState(false);
  const actionsRef = useRef<RecordedAction[]>([]);

  const startRecording = useCallback(() => {
    actionsRef.current = [];
    setRecording(true);
  }, []);

  const stopRecording = useCallback((): string => {
    setRecording(false);
    const actions = actionsRef.current;
    return generateScript(actions);
  }, []);

  const recordAction = useCallback((action: Omit<RecordedAction, 'timestamp'>) => {
    if (!recording) return;  // Use recording from ref check below
    actionsRef.current.push({ ...action, timestamp: Date.now() });
  }, [recording]);

  return { recording, startRecording, stopRecording, recordAction };
}

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function generateScript(actions: RecordedAction[]): string {
  if (actions.length === 0) return '// No actions recorded\n';

  const lines: string[] = ['// Recorded macro'];
  for (const action of actions) {
    switch (action.type) {
      case 'insert':
        if (action.position !== undefined) {
          lines.push(`md.doc.insertText('${escapeString(action.text ?? '')}', ${action.position});`);
        } else {
          lines.push(`md.doc.insertText('${escapeString(action.text ?? '')}');`);
        }
        break;
      case 'delete':
        lines.push(`// Delete ${action.length ?? 0} characters at position ${action.position ?? 0}`);
        lines.push(`md.doc.replaceAll('${escapeString(action.text ?? '')}', '');`);
        break;
      case 'replace':
        lines.push(`md.doc.replaceAll('${escapeString(action.search ?? '')}', '${escapeString(action.replacement ?? '')}');`);
        break;
    }
  }
  return lines.join('\n') + '\n';
}

export default function MacroRecorder({ onStop }: MacroRecorderProps) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleStop = useCallback(() => {
    // Dispatch event so App can handle it
    window.dispatchEvent(new CustomEvent('macro-recording-stop'));
    onStop('');
  }, [onStop]);

  const handleStopAndSave = useCallback(() => {
    const name = window.prompt('Save recorded macro as:');
    if (name) {
      window.dispatchEvent(new CustomEvent('macro-recording-stop-save', { detail: { name } }));
    }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#f44336', color: '#fff', padding: '8px 16px',
      borderRadius: 20, display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 1001, fontSize: 13,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <span style={{ animation: 'pulse 1s infinite', width: 10, height: 10, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
      <span>Recording macro — {formatTime(elapsed)}</span>
      <button onClick={handleStopAndSave}
        style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, cursor: 'pointer' }}>
        💾 Stop & Save
      </button>
      <button onClick={handleStop}
        style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, cursor: 'pointer' }}>
        ⏹ Stop
      </button>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  );
}
