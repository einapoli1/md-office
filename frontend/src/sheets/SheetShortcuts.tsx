import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: 'Tab', desc: 'Move to next cell' },
      { keys: 'Shift+Tab', desc: 'Move to previous cell' },
      { keys: 'Enter', desc: 'Move down / confirm edit' },
      { keys: '↑ ↓ ← →', desc: 'Move between cells' },
      { keys: '⌘+Home', desc: 'Go to cell A1' },
    ],
  },
  {
    category: 'Editing',
    items: [
      { keys: 'F2', desc: 'Enter edit mode' },
      { keys: 'Escape', desc: 'Cancel edit' },
      { keys: 'Delete', desc: 'Clear cell content' },
      { keys: '⌘+Z', desc: 'Undo' },
      { keys: '⌘+Shift+Z', desc: 'Redo' },
    ],
  },
  {
    category: 'Formatting',
    items: [
      { keys: '⌘+B', desc: 'Bold' },
      { keys: '⌘+I', desc: 'Italic' },
      { keys: '⌘+U', desc: 'Underline' },
    ],
  },
  {
    category: 'Selection',
    items: [
      { keys: 'Shift+↑↓←→', desc: 'Extend selection' },
      { keys: '⌘+A', desc: 'Select all cells' },
    ],
  },
  {
    category: 'Clipboard',
    items: [
      { keys: '⌘+C', desc: 'Copy' },
      { keys: '⌘+X', desc: 'Cut' },
      { keys: '⌘+V', desc: 'Paste' },
    ],
  },
  {
    category: 'Data',
    items: [
      { keys: '⌘+F', desc: 'Find' },
      { keys: '⌘+H', desc: 'Find & replace' },
      { keys: '⌘+/', desc: 'Show keyboard shortcuts' },
    ],
  },
];

const SheetShortcuts: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen(prev => !prev);
    window.addEventListener('sheet-shortcuts-toggle', toggle);
    return () => window.removeEventListener('sheet-shortcuts-toggle', toggle);
  }, []);

  if (!open) return null;

  return (
    <div className="sheet-dialog-overlay" onClick={() => setOpen(false)}>
      <div
        className="sheet-dialog"
        style={{ minWidth: 420, maxWidth: 520 }}
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

export default SheetShortcuts;
