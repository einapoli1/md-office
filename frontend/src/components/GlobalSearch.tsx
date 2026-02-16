import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Table2, Presentation, Clock, ArrowUp, ArrowDown } from 'lucide-react';

interface SearchResult {
  filePath: string;
  fileName: string;
  type: 'docs' | 'sheets' | 'slides';
  matches: { line: number; text: string; matchStart: number; matchEnd: number }[];
  filenameMatch: boolean;
}

interface GlobalSearchProps {
  files: { path: string; isDirectory: boolean; children?: any[] }[];
  onOpenFile: (filePath: string) => void;
  getFileContent: (filePath: string) => Promise<string>;
  isOpen: boolean;
  onClose: () => void;
}

const RECENT_KEY = 'md-office-recent-searches';
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter(s => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function detectFileType(path: string): 'docs' | 'sheets' | 'slides' {
  if (/\.slides\.md$/i.test(path)) return 'slides';
  if (/\.(sheet\.md|mds|tsv)$/i.test(path)) return 'sheets';
  return 'docs';
}

function flattenFiles(items: any[]): { path: string }[] {
  const result: { path: string }[] = [];
  for (const item of items) {
    if (item.isDirectory && item.children) {
      result.push(...flattenFiles(item.children));
    } else if (!item.isDirectory) {
      result.push({ path: item.path });
    }
  }
  return result;
}

/** Simple fuzzy match: all chars of needle appear in order in haystack */
function fuzzyMatch(needle: string, haystack: string): boolean {
  const nl = needle.toLowerCase();
  const hl = haystack.toLowerCase();
  let ni = 0;
  for (let hi = 0; hi < hl.length && ni < nl.length; hi++) {
    if (hl[hi] === nl[ni]) ni++;
  }
  return ni === nl.length;
}

const FileIcon: React.FC<{ type: 'docs' | 'sheets' | 'slides' }> = ({ type }) => {
  switch (type) {
    case 'sheets': return <Table2 size={16} style={{ color: '#0f9d58' }} />;
    case 'slides': return <Presentation size={16} style={{ color: '#f4b400' }} />;
    default: return <FileText size={16} style={{ color: '#4285f4' }} />;
  }
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({ files, onOpenFile, getFileContent, isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('global-search-toggle'));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p' && !e.shiftKey) {
        // Only intercept Cmd+P if not printing
        // Actually let's not override Cmd+P since it's print
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const searchId = ++abortRef.current;
    setSearching(true);

    const allFiles = flattenFiles(files);
    const searchResults: SearchResult[] = [];
    const lowerQ = q.toLowerCase();

    for (const file of allFiles) {
      if (abortRef.current !== searchId) return; // aborted

      const fileName = file.path.split('/').pop() || file.path;
      const filenameMatch = fuzzyMatch(q, fileName);
      const type = detectFileType(file.path);

      try {
        const content = await getFileContent(file.path);
        const lines = content.split('\n');
        const matches: SearchResult['matches'] = [];

        for (let i = 0; i < lines.length && matches.length < 5; i++) {
          const lowerLine = lines[i].toLowerCase();
          const idx = lowerLine.indexOf(lowerQ);
          if (idx !== -1) {
            matches.push({
              line: i + 1,
              text: lines[i],
              matchStart: idx,
              matchEnd: idx + q.length,
            });
          }
        }

        if (filenameMatch || matches.length > 0) {
          searchResults.push({ filePath: file.path, fileName, type, matches, filenameMatch });
        }
      } catch {
        // Skip files that can't be read
        if (filenameMatch) {
          searchResults.push({ filePath: file.path, fileName, type, matches: [], filenameMatch });
        }
      }
    }

    if (abortRef.current !== searchId) return;

    // Sort: filename matches first, then by number of content matches
    searchResults.sort((a, b) => {
      if (a.filenameMatch && !b.filenameMatch) return -1;
      if (!a.filenameMatch && b.filenameMatch) return 1;
      return b.matches.length - a.matches.length;
    });

    setResults(searchResults.slice(0, 20));
    setSelectedIndex(0);
    setSearching(false);
  }, [files, getFileContent]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const totalItems = results.reduce((sum, r) => sum + Math.max(1, r.matches.length), 0);

  const handleSelect = (filePath: string) => {
    if (query.trim()) saveRecentSearch(query.trim());
    onOpenFile(filePath);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Find which result corresponds to selectedIndex
      let idx = 0;
      for (const r of results) {
        const count = Math.max(1, r.matches.length);
        if (selectedIndex < idx + count) {
          handleSelect(r.filePath);
          return;
        }
        idx += count;
      }
    }
  };

  const handleRecentClick = (q: string) => {
    setQuery(q);
  };

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-palette" onClick={e => e.stopPropagation()}>
        <div className="global-search-input-row">
          <Search size={18} className="global-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Search across all documents..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {query && (
            <button className="global-search-clear" onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="global-search-results" ref={resultsRef}>
          {!query.trim() && recentSearches.length > 0 && (
            <div className="global-search-section">
              <div className="global-search-section-title">
                <Clock size={14} /> Recent searches
              </div>
              {recentSearches.map((s, i) => (
                <button key={i} className="global-search-recent-item" onClick={() => handleRecentClick(s)}>
                  <Clock size={14} />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          )}

          {query.trim() && searching && (
            <div className="global-search-status">Searching...</div>
          )}

          {query.trim() && !searching && results.length === 0 && (
            <div className="global-search-status">No results found</div>
          )}

          {results.map((result, ri) => {
            // Calculate the starting flat index for this result group
            let flatStart = 0;
            for (let i = 0; i < ri; i++) {
              flatStart += Math.max(1, results[i].matches.length);
            }

            return (
              <div key={result.filePath} className="global-search-group">
                <div className="global-search-file-header">
                  <FileIcon type={result.type} />
                  <span className="global-search-filename">{result.fileName}</span>
                  <span className="global-search-filepath">{result.filePath}</span>
                  {result.matches.length > 0 && (
                    <span className="global-search-match-count">{result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}</span>
                  )}
                </div>
                {result.matches.length === 0 && (
                  <button
                    className={`global-search-match-item ${selectedIndex === flatStart ? 'selected' : ''}`}
                    onClick={() => handleSelect(result.filePath)}
                  >
                    <span className="global-search-match-text">Open file</span>
                  </button>
                )}
                {result.matches.map((match, mi) => {
                  const snippet = match.text.trim();
                  const before = snippet.substring(0, match.matchStart).slice(-40);
                  const matched = snippet.substring(match.matchStart, match.matchEnd);
                  const after = snippet.substring(match.matchEnd).slice(0, 60);
                  return (
                    <button
                      key={mi}
                      className={`global-search-match-item ${selectedIndex === flatStart + mi ? 'selected' : ''}`}
                      onClick={() => handleSelect(result.filePath)}
                    >
                      <span className="global-search-line-num">L{match.line}</span>
                      <span className="global-search-match-text">
                        {before}<mark>{matched}</mark>{after}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="global-search-footer">
          <span><ArrowUp size={12} /> <ArrowDown size={12} /> to navigate</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
