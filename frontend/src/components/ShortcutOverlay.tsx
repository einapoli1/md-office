import React, { useState, useMemo } from 'react';
import { X, Search, AlertTriangle } from 'lucide-react';
import { commandRegistry, CommandCategory } from '../lib/commandRegistry';
import { shortcutManager } from '../lib/shortcutManager';

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: CommandCategory[] = ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Navigate', 'Sheets', 'Slides', 'General'];

const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');

  const allCommands = useMemo(() => {
    return commandRegistry.getAllCommands().filter(c => c.shortcut);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const conflicts = useMemo(() => shortcutManager.detectConflicts(), [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const conflictKeys = useMemo(() => {
    const set = new Set<string>();
    conflicts.forEach(c => set.add(c.key));
    return set;
  }, [conflicts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCommands;
    const q = search.toLowerCase();
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.shortcut?.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [allCommands, search]);

  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, typeof filtered>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) ?? [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    return CATEGORIES.filter(c => map.has(c)).map(c => ({ category: c, commands: map.get(c)! }));
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="shortcuts-overlay" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="dialog-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="shortcuts-search-bar">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {conflicts.length > 0 && (
          <div className="shortcuts-conflicts">
            <AlertTriangle size={14} />
            <span>{conflicts.length} shortcut conflict{conflicts.length > 1 ? 's' : ''} detected</span>
          </div>
        )}

        <div className="shortcuts-content">
          {grouped.map(group => (
            <div key={group.category} className="shortcuts-section">
              <h4>{group.category}</h4>
              {group.commands.map(cmd => (
                <div
                  key={cmd.id}
                  className={`shortcut-row ${cmd.shortcut && conflictKeys.has(cmd.shortcut.toLowerCase()) ? 'conflict' : ''}`}
                >
                  <span className="shortcut-desc">{cmd.label}</span>
                  <kbd className="shortcut-keys">{cmd.shortcut}</kbd>
                </div>
              ))}
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="shortcuts-empty">No shortcuts match your search</div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="dialog-ok-btn" onClick={() => window.print()}>Print</button>
          <button className="dialog-ok-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutOverlay;
