import React from 'react';
import { X } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  onClose: () => void;
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const mod = isMac ? '⌘' : 'Ctrl';

const shortcuts = [
  { category: 'General', items: [
    { keys: `${mod}+S`, desc: 'Save document' },
    { keys: `${mod}+F`, desc: 'Find' },
    { keys: `${mod}+H`, desc: 'Find and replace' },
    { keys: `${mod}+P`, desc: 'Print' },
    { keys: `${mod}+Z`, desc: 'Undo' },
    { keys: `${mod}+Shift+Z`, desc: 'Redo' },
  ]},
  { category: 'Formatting', items: [
    { keys: `${mod}+B`, desc: 'Bold' },
    { keys: `${mod}+I`, desc: 'Italic' },
    { keys: `${mod}+U`, desc: 'Underline' },
    { keys: `${mod}+Shift+X`, desc: 'Strikethrough' },
    { keys: `${mod}+E`, desc: 'Center align' },
    { keys: `${mod}+Shift+L`, desc: 'Left align' },
    { keys: `${mod}+Shift+R`, desc: 'Right align' },
    { keys: `${mod}+Shift+J`, desc: 'Justify' },
  ]},
  { category: 'Content', items: [
    { keys: `${mod}+Shift+7`, desc: 'Ordered list' },
    { keys: `${mod}+Shift+8`, desc: 'Bullet list' },
    { keys: `${mod}+Shift+9`, desc: 'Checklist' },
    { keys: `${mod}+K`, desc: 'Insert link' },
    { keys: `${mod}+Enter`, desc: 'Line break' },
  ]},
  { category: 'Headings', items: [
    { keys: `${mod}+Alt+1`, desc: 'Heading 1' },
    { keys: `${mod}+Alt+2`, desc: 'Heading 2' },
    { keys: `${mod}+Alt+3`, desc: 'Heading 3' },
    { keys: `${mod}+Alt+0`, desc: 'Normal text' },
  ]},
];

const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({ onClose }) => {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="shortcuts-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Keyboard shortcuts</h3>
          <button className="dialog-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="shortcuts-content">
          {shortcuts.map(section => (
            <div key={section.category} className="shortcuts-section">
              <h4>{section.category}</h4>
              {section.items.map(item => (
                <div key={item.keys} className="shortcut-row">
                  <span className="shortcut-desc">{item.desc}</span>
                  <kbd className="shortcut-keys">{item.keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="dialog-footer">
          <button className="dialog-ok-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsDialog;
