import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: '↑ ↓', desc: 'Previous / next slide' },
      { keys: 'Page Up / Down', desc: 'Previous / next slide' },
      { keys: 'Home / End', desc: 'First / last slide' },
    ],
  },
  {
    category: 'Editing',
    items: [
      { keys: '⌘+Z', desc: 'Undo' },
      { keys: '⌘+Shift+Z', desc: 'Redo' },
      { keys: '⌘+C / ⌘+V / ⌘+X', desc: 'Copy / Paste / Cut' },
      { keys: 'Delete', desc: 'Delete selected element' },
      { keys: '⌘+D', desc: 'Duplicate slide' },
    ],
  },
  {
    category: 'Presentation',
    items: [
      { keys: 'F5', desc: 'Start presentation from beginning' },
      { keys: 'Escape', desc: 'Exit presentation' },
      { keys: '→ / Space', desc: 'Next slide (presenting)' },
      { keys: '← / Backspace', desc: 'Previous slide (presenting)' },
    ],
  },
  {
    category: 'Shapes & Objects',
    items: [
      { keys: 'Shift+drag', desc: 'Constrain proportions' },
      { keys: 'Alt+drag', desc: 'Duplicate shape' },
      { keys: '⌘+A', desc: 'Select all on slide' },
    ],
  },
  {
    category: 'General',
    items: [
      { keys: '⌘+/', desc: 'Show keyboard shortcuts' },
      { keys: '⌘+F', desc: 'Find' },
    ],
  },
];

const SlideShortcuts: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen(prev => !prev);
    window.addEventListener('slide-shortcuts-toggle', toggle);
    // Also listen for global Cmd+/ when in slides mode
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('slide-shortcuts-toggle', toggle);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: 'var(--primary-bg, #fff)', borderRadius: 8, padding: 20,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', minWidth: 420, maxWidth: 520,
          maxHeight: '80vh', overflowY: 'auto', color: 'var(--text-primary, #202124)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Keyboard Shortcuts</h3>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: 'inherit' }}
          >
            <X size={18} />
          </button>
        </div>
        {shortcuts.map(section => (
          <div key={section.category} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#5f6368', marginBottom: 6 }}>
              {section.category}
            </div>
            {section.items.map(item => (
              <div key={item.keys} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{item.desc}</span>
                <kbd style={{
                  background: 'var(--tertiary-bg, #f1f3f4)',
                  border: '1px solid var(--border-light, #e0e0e0)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}>{item.keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SlideShortcuts;
