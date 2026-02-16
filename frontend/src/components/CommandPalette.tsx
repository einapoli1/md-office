import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Command, CommandCategory, commandRegistry } from '../lib/commandRegistry';
import { Search, Star, Clock, ChevronRight, FileText, Hash, Type, Image, Eye, Settings, Navigation, Table2, Presentation, Command as CommandIcon } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  contextMode?: string;
  recentDocs?: { id: string; title: string; mode: string; updatedAt: number }[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  File: <FileText size={12} />,
  Edit: <Type size={12} />,
  View: <Eye size={12} />,
  Insert: <Image size={12} />,
  Format: <Hash size={12} />,
  Tools: <Settings size={12} />,
  Navigate: <Navigation size={12} />,
  Sheets: <Table2 size={12} />,
  Slides: <Presentation size={12} />,
  General: <CommandIcon size={12} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  File: '#4a9eff',
  Edit: '#ff9f43',
  View: '#a29bfe',
  Insert: '#00cec9',
  Format: '#fd79a8',
  Tools: '#636e72',
  Navigate: '#6c5ce7',
  Sheets: '#00b894',
  Slides: '#e17055',
  General: '#74b9ff',
};

interface FileResult {
  id: string;
  title: string;
  mode: string;
  updatedAt: number;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, contextMode, recentDocs = [] }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Command[]>([]);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'commands' | 'files'>('commands');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isCommandMode = query.startsWith('>');

  const updateResults = useCallback((q: string) => {
    if (q.startsWith('>')) {
      // Command mode: strip ">" prefix
      const cmdQuery = q.slice(1).trim();
      const cmds = commandRegistry.searchCommands(cmdQuery, contextMode);
      setResults(cmds);
      setFileResults([]);
      setMode('commands');
    } else if (q.trim() === '') {
      // Empty: show recent commands
      const cmds = commandRegistry.searchCommands('', contextMode);
      setResults(cmds);
      setFileResults([]);
      setMode('commands');
    } else {
      // File search mode
      const lower = q.toLowerCase();
      const filtered = recentDocs.filter(d =>
        d.title.toLowerCase().includes(lower)
      ).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
      setFileResults(filtered);
      setResults([]);
      setMode('files');
    }
    setSelectedIndex(0);
  }, [contextMode, recentDocs]);

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

  const totalCount = mode === 'files' ? fileResults.length : results.length;

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
      setSelectedIndex(i => Math.min(i + 1, totalCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'files') {
        const file = fileResults[selectedIndex];
        if (file) {
          onClose();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-document', { detail: { id: file.id, mode: file.mode } }));
          }, 0);
        }
      } else {
        const cmd = results[selectedIndex];
        if (cmd) {
          onClose();
          setTimeout(() => commandRegistry.executeCommand(cmd.id), 0);
        }
      }
    }
  }, [results, fileResults, selectedIndex, onClose, totalCount, mode]);

  const handlePinClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    commandRegistry.togglePin(id);
    updateResults(query);
  }, [query, updateResults]);

  if (!isOpen) return null;

  // Group commands by category for display
  const groupedCommands: { category: CommandCategory; commands: Command[] }[] = [];
  if (mode === 'commands' && results.length > 0) {
    const catMap = new Map<CommandCategory, Command[]>();
    // Keep order from search results but group
    for (const cmd of results) {
      let arr = catMap.get(cmd.category);
      if (!arr) {
        arr = [];
        catMap.set(cmd.category, arr);
      }
      arr.push(cmd);
    }
    for (const [category, commands] of catMap) {
      groupedCommands.push({ category, commands });
    }
  }

  return (
    <div className="command-palette-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-input-wrap">
          <Search size={16} className="command-palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={isCommandMode ? 'Search commands...' : 'Search files or type > for commands...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search commands"
          />
          {!isCommandMode && query === '' && (
            <span className="command-palette-hint">Type &gt; for commands</span>
          )}
        </div>

        <div className="command-palette-list" ref={listRef} role="listbox">
          {mode === 'files' && fileResults.length === 0 && (
            <div className="command-palette-empty">No matching files</div>
          )}
          {mode === 'files' && fileResults.map((file, i) => (
            <div
              key={file.id}
              className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => {
                onClose();
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('open-document', { detail: { id: file.id, mode: file.mode } }));
                }, 0);
              }}
            >
              <div className="command-palette-item-left">
                <FileText size={14} style={{ opacity: 0.5, marginRight: 8 }} />
                <span className="command-palette-label">{file.title}</span>
              </div>
              <span className="command-palette-badge" style={{ background: file.mode === 'sheets' ? CATEGORY_COLORS.Sheets : file.mode === 'slides' ? CATEGORY_COLORS.Slides : CATEGORY_COLORS.File }}>
                {file.mode}
              </span>
            </div>
          ))}

          {mode === 'commands' && results.length === 0 && (
            <div className="command-palette-empty">No matching commands</div>
          )}
          {mode === 'commands' && results.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              role="option"
              aria-selected={i === selectedIndex}
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
                  aria-label={cmd.pinned ? 'Unpin command' : 'Pin command'}
                >
                  {cmd.pinned ? <Star size={12} fill="currentColor" /> : <Star size={12} />}
                </button>
                <span
                  className="command-palette-badge"
                  style={{ background: CATEGORY_COLORS[cmd.category] || '#888' }}
                >
                  {CATEGORY_ICONS[cmd.category] || null}
                  <span>{cmd.category}</span>
                </span>
                <ChevronRight size={12} className="command-palette-sep" />
                {cmd.icon && <span className="command-palette-icon">{cmd.icon}</span>}
                <span className="command-palette-label">{cmd.label}</span>
              </div>
              {cmd.shortcut && (
                <kbd className="command-palette-shortcut">{cmd.shortcut}</kbd>
              )}
            </div>
          ))}
        </div>
        <div className="command-palette-footer">
          <span><Clock size={12} /> {mode === 'files' ? 'Search recent documents' : 'Recent commands shown when empty'}</span>
          <span>↑↓ navigate · Enter to run · Esc to close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
