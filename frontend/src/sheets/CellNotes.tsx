// Cell notes — simple text tooltips (not threaded comments)
import { useState, useRef, useEffect } from 'react';

interface CellNoteEditorProps {
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

/** Inline note editor popup */
export function CellNoteEditor({ note, onSave, onClose, position }: CellNoteEditorProps) {
  const [text, setText] = useState(note);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    onSave(text.trim());
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', left: position.x, top: position.y,
      background: '#fffde7', border: '1px solid #f9a825', borderRadius: 4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 2000, padding: 8, width: 220,
    }}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Add a note..."
        style={{
          width: '100%', minHeight: 60, resize: 'vertical',
          border: '1px solid #e0e0e0', borderRadius: 3, padding: 6, fontSize: 12,
          fontFamily: 'inherit', background: '#fff',
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
        {note && (
          <button
            onClick={() => { onSave(''); onClose(); }}
            style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer', color: '#c62828' }}
          >
            Delete
          </button>
        )}
        <button onClick={onClose} style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
        <button
          onClick={handleSave}
          style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer', background: '#f9a825', border: 'none', borderRadius: 3, color: '#fff' }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

/** Hover tooltip for displaying note content */
export function CellNoteTooltip({ note, position }: { note: string; position: { x: number; y: number } }) {
  return (
    <div style={{
      position: 'fixed', left: position.x + 8, top: position.y + 8,
      background: '#fffde7', border: '1px solid #f9a825', borderRadius: 4,
      boxShadow: '0 1px 4px rgba(0,0,0,0.12)', padding: '6px 10px',
      fontSize: 12, maxWidth: 250, whiteSpace: 'pre-wrap', zIndex: 2000,
      pointerEvents: 'none',
    }}>
      {note}
    </div>
  );
}

/** Note indicator triangle rendered in cell corner */
export function CellNoteIndicator() {
  return (
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: 0, height: 0,
      borderLeft: '6px solid transparent',
      borderTop: '6px solid #ff9800',
      pointerEvents: 'none',
    }} />
  );
}
