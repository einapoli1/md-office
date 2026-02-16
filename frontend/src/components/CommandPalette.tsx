import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Command, commandRegistry } from '../lib/commandRegistry';
import { Search, Star, Clock, ChevronRight } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  contextMode?: string;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, contextMode }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const updateResults = useCallback((q: string) => {
    const cmds = commandRegistry.searchCommands(q, contextMode);
    setResults(cmds);
    setSelectedIndex(0);
  }, [contextMode]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      updateResults('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, updateResults]);

  useEffect(() => {
    updateResults(query);
  }, [query, updateResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = results[selectedIndex];
      if (cmd) {
        onClose();
        // Defer execution so the palette closes first
        setTimeout(() => commandRegistry.executeCommand(cmd.id), 0);
      }
    }
  }, [results, selectedIndex, onClose]);

  const handlePinClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    commandRegistry.togglePin(id);
    updateResults(query);
  }, [query, updateResults]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-input-wrap">
          <Search size={16} className="command-palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="command-palette-list" ref={listRef}>
          {results.length === 0 && (
            <div className="command-palette-empty">No matching commands</div>
          )}
          {results.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => {
                onClose();
                setTimeout(() => commandRegistry.executeCommand(cmd.id), 0);
              }}
            >
              <div className="command-palette-item-left">
                <button
                  className={`command-palette-pin ${cmd.pinned ? 'pinned' : ''}`}
                  onClick={e => handlePinClick(e, cmd.id)}
                  title={cmd.pinned ? 'Unpin' : 'Pin'}
                >
                  {cmd.pinned ? <Star size={12} fill="currentColor" /> : <Star size={12} />}
                </button>
                <span className="command-palette-category">{cmd.category}</span>
                <ChevronRight size={12} className="command-palette-sep" />
                <span className="command-palette-label">{cmd.label}</span>
              </div>
              {cmd.shortcut && (
                <kbd className="command-palette-shortcut">{cmd.shortcut}</kbd>
              )}
            </div>
          ))}
        </div>
        <div className="command-palette-footer">
          <span><Clock size={12} /> Recent commands shown when empty</span>
          <span>↑↓ navigate · Enter to run · Esc to close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
