import { useState, useRef, useCallback } from 'react';

export interface TimestampMarker {
  id: string;
  time: string; // e.g. "1:30"
  text: string;
}

interface SlideNotesProps {
  notes: string;
  onChange: (notes: string) => void;
  slideIndex: number;
  totalSlides: number;
  allNotes: { slideIndex: number; notes: string }[];
}

export default function SlideNotes({ notes, onChange, slideIndex, totalSlides, allNotes }: SlideNotesProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(160);
  const [timestamps, setTimestamps] = useState<TimestampMarker[]>([]);
  const dragRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setHeight(Math.max(60, startH - (ev.clientY - startY)));
    };
    const onUp = () => {
      dragRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height]);

  const wrapText = useCallback((wrapper: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = notes.substring(start, end);
    if (selected) {
      const newText = notes.substring(0, start) + wrapper + selected + wrapper + notes.substring(end);
      onChange(newText);
    } else {
      onChange(notes + wrapper + 'text' + wrapper);
    }
  }, [notes, onChange]);

  const insertList = useCallback(() => {
    onChange(notes + '\n- ');
  }, [notes, onChange]);

  const addTimestamp = useCallback(() => {
    const now = new Date();
    const timeStr = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}`;
    const marker: TimestampMarker = {
      id: `ts-${Date.now()}`,
      time: timeStr,
      text: `[${timeStr}]`,
    };
    setTimestamps(prev => [...prev, marker]);
    onChange(notes + `\n[${timeStr}] `);
  }, [notes, onChange]);

  const exportAllNotes = useCallback(() => {
    const lines = allNotes
      .filter(n => n.notes.trim())
      .map(n => `## Slide ${n.slideIndex + 1}\n\n${n.notes}`)
      .join('\n\n---\n\n');
    const blob = new Blob([`# Presentation Notes\n\n${lines}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation-notes.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [allNotes]);

  const renderPreview = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/\[(\d+:\d+)\]/g, '<span style="color:#4299e1;cursor:pointer;font-weight:600">[$1]</span>');
  };

  return (
    <div className="slide-notes-enhanced">
      <div
        className="slide-notes-drag-handle"
        onMouseDown={handleDragStart}
        style={{
          height: 6, cursor: 'ns-resize', background: '#e2e8f0',
          borderRadius: '3px 3px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ width: 32, height: 2, background: '#a0aec0', borderRadius: 1 }} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', background: '#f7fafc', borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 12, border: 'none', background: 'none', cursor: 'pointer' }}>
            {collapsed ? '▶' : '▼'} Speaker Notes
          </button>
          <span style={{ fontSize: 11, color: '#718096' }}>Slide {slideIndex + 1}/{totalSlides}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!collapsed && (
            <>
              <button onClick={() => wrapText('**')} title="Bold" style={{ fontWeight: 700, fontSize: 12, padding: '1px 4px', border: '1px solid #ccc', background: '#fff', borderRadius: 3 }}>B</button>
              <button onClick={() => wrapText('*')} title="Italic" style={{ fontStyle: 'italic', fontSize: 12, padding: '1px 4px', border: '1px solid #ccc', background: '#fff', borderRadius: 3 }}>I</button>
              <button onClick={insertList} title="List" style={{ fontSize: 12, padding: '1px 4px', border: '1px solid #ccc', background: '#fff', borderRadius: 3 }}>•</button>
              <button onClick={addTimestamp} title="Add timestamp" style={{ fontSize: 12, padding: '1px 4px', border: '1px solid #ccc', background: '#fff', borderRadius: 3 }}>⏱</button>
              <span style={{ fontSize: 10, color: '#a0aec0', marginLeft: 8 }}>{notes.length} chars</span>
            </>
          )}
          <button onClick={exportAllNotes} title="Export all notes" style={{ fontSize: 11, padding: '1px 6px', border: '1px solid #ccc', background: '#fff', borderRadius: 3, marginLeft: 4 }}>📥 Export</button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', height, overflow: 'hidden' }}>
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={e => onChange(e.target.value)}
            placeholder="Speaker notes… (supports **bold**, *italic*, - lists, [0:00] timestamps)"
            style={{
              flex: 1, resize: 'none', border: 'none', padding: 8, fontSize: 13,
              fontFamily: 'inherit', outline: 'none', background: '#fff',
            }}
          />
          {notes.trim() && (
            <div
              style={{
                flex: 1, padding: 8, fontSize: 13, overflowY: 'auto',
                borderLeft: '1px solid #e2e8f0', background: '#fafafa',
                lineHeight: 1.5,
              }}
              dangerouslySetInnerHTML={{ __html: renderPreview(notes) }}
            />
          )}
        </div>
      )}

      {!collapsed && timestamps.length > 0 && (
        <div style={{
          display: 'flex', gap: 4, padding: '2px 8px', background: '#edf2f7',
          borderTop: '1px solid #e2e8f0', flexWrap: 'wrap',
        }}>
          {timestamps.map(ts => (
            <span key={ts.id} style={{ fontSize: 10, color: '#4299e1', cursor: 'pointer', padding: '1px 4px', background: '#ebf8ff', borderRadius: 3 }}>
              {ts.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
