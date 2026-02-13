import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Search, X, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

interface FindReplaceProps {
  editor: Editor;
  isVisible: boolean;
  onClose: () => void;
}

interface SearchMatch {
  from: number;
  to: number;
}

const FindReplace: React.FC<FindReplaceProps> = ({ editor, isVisible, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<SearchMatch[]>([]);

  const findMatches = useCallback(() => {
    if (!searchTerm || !editor) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const { state } = editor;
    const { doc } = state;
    const matches: SearchMatch[] = [];
    
    const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    doc.descendants((node, pos) => {
      if (node.isText) {
        const text = caseSensitive ? node.text : node.text?.toLowerCase();
        if (text) {
          let index = 0;
          while (index < text.length) {
            const found = text.indexOf(searchText, index);
            if (found === -1) break;
            
            matches.push({
              from: pos + found,
              to: pos + found + searchTerm.length,
            });
            index = found + 1;
          }
        }
      }
    });

    setMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [searchTerm, caseSensitive, editor]);

  const highlightMatches = useCallback(() => {
    if (!editor) return;

    // Clear previous decorations
    editor.chain().unsetHighlight().run();

    // Highlight all matches
    matches.forEach((match, index) => {
      editor.chain()
        .setTextSelection({ from: match.from, to: match.to })
        .setHighlight({ 
          color: index === currentMatchIndex ? '#ff6b35' : '#ffe066' 
        })
        .run();
    });

    // Focus on current match
    if (currentMatchIndex >= 0 && matches[currentMatchIndex]) {
      const match = matches[currentMatchIndex];
      editor.chain()
        .setTextSelection({ from: match.from, to: match.to })
        .focus()
        .run();
      
      // Scroll to match
      const view = editor.view;
      const coords = view.coordsAtPos(match.from);
      view.dom.closest('.editor')?.scrollTo({
        top: coords.top - 100,
        behavior: 'smooth'
      });
    }
  }, [editor, matches, currentMatchIndex]);

  useEffect(() => {
    findMatches();
  }, [findMatches]);

  useEffect(() => {
    highlightMatches();
  }, [highlightMatches]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  const findNext = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const findPrevious = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const replaceOne = () => {
    if (currentMatchIndex < 0 || !matches[currentMatchIndex] || !editor) return;

    const match = matches[currentMatchIndex];
    editor.chain()
      .setTextSelection({ from: match.from, to: match.to })
      .insertContent(replaceTerm)
      .focus()
      .run();

    // Update search after replacement
    setTimeout(() => findMatches(), 50);
  };

  const replaceAll = () => {
    if (matches.length === 0 || !editor) return;

    // Replace all matches from end to beginning to maintain positions
    const sortedMatches = [...matches].sort((a, b) => b.from - a.from);
    
    editor.chain().focus();
    sortedMatches.forEach(match => {
      editor.chain()
        .setTextSelection({ from: match.from, to: match.to })
        .insertContent(replaceTerm)
        .run();
    });

    setTimeout(() => findMatches(), 50);
  };

  if (!isVisible) return null;

  return (
    <div className="find-replace-bar">
      <div className="find-replace-content">
        <div className="search-section">
          <div className="search-input-container">
            <Search size={14} />
            <input
              type="text"
              placeholder="Find"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              autoFocus
            />
            <span className="match-count">
              {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : 'No matches'}
            </span>
          </div>
          
          <div className="search-controls">
            <button 
              onClick={findPrevious} 
              disabled={matches.length === 0}
              title="Previous match (Shift+Enter)"
              className="icon-button"
            >
              <ChevronUp size={14} />
            </button>
            <button 
              onClick={findNext} 
              disabled={matches.length === 0}
              title="Next match (Enter)"
              className="icon-button"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        <div className="replace-section">
          <div className="replace-input-container">
            <RotateCcw size={14} />
            <input
              type="text"
              placeholder="Replace"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="replace-input"
            />
          </div>
          
          <div className="replace-controls">
            <button 
              onClick={replaceOne}
              disabled={currentMatchIndex < 0}
              title="Replace current"
              className="replace-button"
            >
              Replace
            </button>
            <button 
              onClick={replaceAll}
              disabled={matches.length === 0}
              title="Replace all"
              className="replace-all-button"
            >
              All
            </button>
          </div>
        </div>

        <div className="find-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Case sensitive
          </label>
        </div>
      </div>
      
      <button onClick={onClose} className="close-button" title="Close (Esc)">
        <X size={14} />
      </button>
    </div>
  );
};

export default FindReplace;