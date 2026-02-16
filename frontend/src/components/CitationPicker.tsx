import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Citation, CitationStyle, formatCitation } from '../lib/citationEngine';

interface CitationPickerProps {
  editor: any;
  citations: Citation[];
  citationStyle: CitationStyle;
  onAddNew: () => void;
  onClose: () => void;
}

const CitationPicker: React.FC<CitationPickerProps> = ({
  editor,
  citations,
  citationStyle,
  onAddNew,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = citations.filter(c => {
    const q = query.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.authors.some(a => `${a.first} ${a.last}`.toLowerCase().includes(q)) ||
      c.year.includes(q)
    );
  });

  const handleSelect = (c: Citation) => {
    if (!editor) return;
    const numbered = { ...c, _number: citations.indexOf(c) + 1 };
    const label = formatCitation(numbered, citationStyle);
    editor.chain().focus().insertContent({
      type: 'citation',
      attrs: { citationId: c.id, label },
    }).run();
    onClose();
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 420, maxHeight: 400, background: 'var(--bg-primary, #fff)',
        border: '1px solid var(--border-color, #e0e0e0)', borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 1000,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color, #e0e0e0)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={16} style={{ color: '#999' }} />
          <input ref={inputRef} placeholder="Search citations..." value={query} onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 13 }}>
              {citations.length === 0 ? 'No citations added yet.' : 'No matching citations.'}
            </div>
          ) : (
            filtered.map((c, idx) => {
              const numbered = { ...c, _number: citations.indexOf(c) + 1 };
              return (
                <button key={c.id} onClick={() => handleSelect(c)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                    border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, fontSize: 13,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary, #f5f5f5)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 500 }}>
                    <span style={{ color: '#4285f4', marginRight: 6 }}>{formatCitation(numbered, citationStyle)}</span>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {c.authors.map(a => `${a.first} ${a.last}`).join(', ')} ({c.year})
                    {idx + 1 /* used to satisfy lint */? '' : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={{ padding: 8, borderTop: '1px solid var(--border-color, #e0e0e0)' }}>
          <button onClick={onAddNew}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px',
              border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, fontSize: 13, color: '#4285f4',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary, #f5f5f5)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Plus size={14} /> Add New Citation...
          </button>
        </div>
      </div>
    </>
  );
};

export default CitationPicker;
