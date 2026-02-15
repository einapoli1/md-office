import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronUp, ChevronDown, Replace } from 'lucide-react';

interface FindReplaceProps {
  editor: any;
  onClose: () => void;
  showReplace?: boolean;
}

interface Match {
  from: number;
  to: number;
}

const FindReplace: React.FC<FindReplaceProps> = ({ editor, onClose, showReplace = false }) => {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState(-1);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplaceRow, setShowReplaceRow] = useState(showReplace);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const decorationsApplied = useRef(false);

  // Focus search input on mount
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Search the document
  const doSearch = useCallback(() => {
    if (!editor || !searchText) {
      setMatches([]);
      setCurrentMatch(-1);
      // Clear highlight decorations
      clearHighlights();
      return;
    }

    const { doc } = editor.state;
    const found: Match[] = [];
    const searchLower = caseSensitive ? searchText : searchText.toLowerCase();

    doc.descendants((node: any, pos: number) => {
      if (!node.isText) return;
      const text = caseSensitive ? node.text : node.text.toLowerCase();
      let index = 0;
      while (true) {
        const i = text.indexOf(searchLower, index);
        if (i === -1) break;
        found.push({ from: pos + i, to: pos + i + searchText.length });
        index = i + 1;
      }
    });

    setMatches(found);
    if (found.length > 0) {
      setCurrentMatch(0);
      scrollToMatch(found[0]);
    } else {
      setCurrentMatch(-1);
    }

    applyHighlights();
  }, [editor, searchText, caseSensitive]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 200);
    return () => clearTimeout(timer);
  }, [doSearch]);

  const clearHighlights = useCallback(() => {
    if (!editor) return;
    decorationsApplied.current = false;
  }, [editor]);

  const applyHighlights = useCallback(() => {
    // We use selection-based highlighting — the active match gets a text selection.
    decorationsApplied.current = true;
  }, []);

  const scrollToMatch = useCallback((match: Match) => {
    if (!editor) return;
    // Select the match text
    editor.commands.setTextSelection({ from: match.from, to: match.to });
    // Scroll into view
    editor.commands.scrollIntoView();
  }, [editor]);

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = (currentMatch + 1) % matches.length;
    setCurrentMatch(next);
    scrollToMatch(matches[next]);
  }, [matches, currentMatch, scrollToMatch]);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (currentMatch - 1 + matches.length) % matches.length;
    setCurrentMatch(prev);
    scrollToMatch(matches[prev]);
  }, [matches, currentMatch, scrollToMatch]);

  const handleReplace = useCallback(() => {
    if (!editor || currentMatch < 0 || currentMatch >= matches.length) return;
    const match = matches[currentMatch];

    const { tr } = editor.state;
    tr.insertText(replaceText, match.from, match.to);
    editor.view.dispatch(tr);

    // Re-search after replacement
    setTimeout(doSearch, 50);
  }, [editor, matches, currentMatch, replaceText, doSearch]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || matches.length === 0) return;

    // Replace in reverse order to preserve positions
    const { tr } = editor.state;
    const sorted = [...matches].sort((a, b) => b.from - a.from);
    for (const match of sorted) {
      tr.insertText(replaceText, match.from, match.to);
    }
    editor.view.dispatch(tr);

    setMatches([]);
    setCurrentMatch(-1);
  }, [editor, matches, replaceText]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        if (e.shiftKey) goToPrev();
        else goToNext();
        e.preventDefault();
      }
      if (e.key === 'h' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowReplaceRow(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToNext, goToPrev]);

  return (
    <div className="find-replace-bar">
      <div className="find-replace-row">
        <input
          ref={searchInputRef}
          className="find-input"
          type="text"
          placeholder="Find"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        <span className="find-count">
          {searchText ? `${matches.length > 0 ? currentMatch + 1 : 0} of ${matches.length}` : ''}
        </span>
        <button className={`find-option-btn ${caseSensitive ? 'active' : ''}`} onClick={() => setCaseSensitive(!caseSensitive)} title="Case sensitive">
          Aa
        </button>
        <button className="find-nav-btn" onClick={goToPrev} disabled={matches.length === 0} title="Previous (Shift+Enter)">
          <ChevronUp size={16} />
        </button>
        <button className="find-nav-btn" onClick={goToNext} disabled={matches.length === 0} title="Next (Enter)">
          <ChevronDown size={16} />
        </button>
        <button className="find-toggle-btn" onClick={() => setShowReplaceRow(!showReplaceRow)} title="Toggle replace (Cmd+H)">
          <Replace size={14} />
        </button>
        <button className="find-close-btn" onClick={onClose} title="Close (Esc)">
          <X size={16} />
        </button>
      </div>

      {showReplaceRow && (
        <div className="find-replace-row replace-row">
          <input
            className="find-input"
            type="text"
            placeholder="Replace with"
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
          />
          <button className="find-action-btn" onClick={handleReplace} disabled={currentMatch < 0} title="Replace">
            Replace
          </button>
          <button className="find-action-btn" onClick={handleReplaceAll} disabled={matches.length === 0} title="Replace all">
            All
          </button>
        </div>
      )}
    </div>
  );
};

export default FindReplace;
