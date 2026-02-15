import React, { useState, useEffect, useCallback, memo } from 'react';
import { Check, X, ChevronDown, ChevronUp, CheckCheck, XCircle } from 'lucide-react';

interface SuggestionItem {
  id: string;
  type: 'insert' | 'delete';
  text: string;
  author: string;
  from: number;
  to: number;
}

interface SuggestionsSidebarProps {
  editor: any;
  onClose: () => void;
}

const SuggestionsSidebar: React.FC<SuggestionsSidebarProps> = ({ editor, onClose }) => {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Scan document for all suggestion marks
  const scanSuggestions = useCallback(() => {
    if (!editor) return;
    const { doc } = editor.state;
    const found = new Map<string, SuggestionItem>();

    doc.descendants((node: any, pos: number) => {
      node.marks?.forEach((mark: any) => {
        if (mark.type.name === 'suggestion') {
          const id = mark.attrs.suggestionId;
          if (!found.has(id)) {
            found.set(id, {
              id,
              type: mark.attrs.suggestionType,
              text: '',
              author: mark.attrs.author || 'Guest',
              from: pos,
              to: pos + node.nodeSize,
            });
          }
          const item = found.get(id)!;
          item.text += node.textContent || '';
          if (pos < item.from) item.from = pos;
          if (pos + node.nodeSize > item.to) item.to = pos + node.nodeSize;
        }
      });
    });

    setSuggestions(Array.from(found.values()));
  }, [editor]);

  useEffect(() => {
    scanSuggestions();
    // Re-scan when document changes
    if (editor) {
      const handler = () => scanSuggestions();
      editor.on('transaction', handler);
      return () => editor.off('transaction', handler);
    }
  }, [editor, scanSuggestions]);

  // Listen for suggestion-add events
  useEffect(() => {
    const handler = () => scanSuggestions();
    window.addEventListener('suggestion-add', handler);
    return () => window.removeEventListener('suggestion-add', handler);
  }, [scanSuggestions]);

  const findSuggestionRange = useCallback((suggestionId: string) => {
    if (!editor) return null;
    const { doc } = editor.state;
    let from: number | null = null;
    let to: number | null = null;
    let type = 'insert';

    doc.descendants((node: any, pos: number) => {
      node.marks?.forEach((mark: any) => {
        if (mark.type.name === 'suggestion' && mark.attrs.suggestionId === suggestionId) {
          if (from === null || pos < from) from = pos;
          if (to === null || pos + node.nodeSize > to) to = pos + node.nodeSize;
          type = mark.attrs.suggestionType;
        }
      });
    });

    return from !== null && to !== null ? { from, to, type } : null;
  }, [editor]);

  const handleAccept = useCallback((id: string) => {
    const range = findSuggestionRange(id);
    if (!range || !editor) return;

    const { tr } = editor.state;
    if (range.type === 'insert') {
      tr.removeMark(range.from, range.to, editor.schema.marks.suggestion);
    } else {
      tr.delete(range.from, range.to);
    }
    editor.view.dispatch(tr);
  }, [editor, findSuggestionRange]);

  const handleReject = useCallback((id: string) => {
    const range = findSuggestionRange(id);
    if (!range || !editor) return;

    const { tr } = editor.state;
    if (range.type === 'insert') {
      tr.delete(range.from, range.to);
    } else {
      tr.removeMark(range.from, range.to, editor.schema.marks.suggestion);
    }
    editor.view.dispatch(tr);
  }, [editor, findSuggestionRange]);

  const handleAcceptAll = useCallback(() => {
    if (!editor) return;
    // Process in reverse order to maintain positions
    const sorted = [...suggestions].sort((a, b) => b.from - a.from);
    let tr = editor.state.tr;
    for (const s of sorted) {
      const range = findSuggestionRange(s.id);
      if (!range) continue;
      if (range.type === 'insert') {
        tr = tr.removeMark(range.from, range.to, editor.schema.marks.suggestion);
      } else {
        tr = tr.delete(range.from, range.to);
      }
    }
    editor.view.dispatch(tr);
  }, [editor, suggestions, findSuggestionRange]);

  const handleRejectAll = useCallback(() => {
    if (!editor) return;
    const sorted = [...suggestions].sort((a, b) => b.from - a.from);
    let tr = editor.state.tr;
    for (const s of sorted) {
      const range = findSuggestionRange(s.id);
      if (!range) continue;
      if (range.type === 'insert') {
        tr = tr.delete(range.from, range.to);
      } else {
        tr = tr.removeMark(range.from, range.to, editor.schema.marks.suggestion);
      }
    }
    editor.view.dispatch(tr);
  }, [editor, suggestions, findSuggestionRange]);

  const scrollToSuggestion = useCallback((from: number) => {
    if (!editor) return;
    editor.commands.focus();
    editor.commands.setTextSelection(from);
    // Scroll into view
    const coords = editor.view.coordsAtPos(from);
    if (coords) {
      const container = editor.view.dom.closest('.main-editor');
      if (container) {
        container.scrollTo({ top: coords.top - container.getBoundingClientRect().top + container.scrollTop - 100, behavior: 'smooth' });
      }
    }
  }, [editor]);

  return (
    <div className="suggestions-sidebar">
      <div className="suggestions-sidebar-header">
        <h3>Suggestions</h3>
        <div className="suggestions-header-actions">
          {suggestions.length > 0 && (
            <>
              <button className="suggestion-bulk-btn accept" onClick={handleAcceptAll} title="Accept all">
                <CheckCheck size={14} /> Accept all
              </button>
              <button className="suggestion-bulk-btn reject" onClick={handleRejectAll} title="Reject all">
                <XCircle size={14} /> Reject all
              </button>
            </>
          )}
          <button className="suggestions-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="suggestions-list">
        {suggestions.length === 0 ? (
          <div className="suggestions-empty">
            <p>No suggestions</p>
            <p className="suggestions-empty-hint">Enable suggestion mode to track changes</p>
          </div>
        ) : (
          suggestions.map(s => (
            <div
              key={s.id}
              className={`suggestion-card ${s.type} ${expandedId === s.id ? 'expanded' : ''}`}
              onClick={() => scrollToSuggestion(s.from)}
            >
              <div className="suggestion-card-header">
                <span className="suggestion-card-author">{s.author}</span>
                <span className={`suggestion-card-type ${s.type}`}>
                  {s.type === 'insert' ? 'Added' : 'Deleted'}
                </span>
                <button
                  className="suggestion-card-expand"
                  onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === s.id ? null : s.id); }}
                >
                  {expandedId === s.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              <div className="suggestion-card-preview">
                <span className={s.type === 'insert' ? 'suggestion-preview-insert' : 'suggestion-preview-delete'}>
                  {s.text.length > 60 && expandedId !== s.id
                    ? s.text.substring(0, 60) + '...'
                    : s.text
                  }
                </span>
              </div>

              {expandedId === s.id && (
                <div className="suggestion-card-actions">
                  <button className="suggestion-accept-btn" onClick={(e) => { e.stopPropagation(); handleAccept(s.id); }}>
                    <Check size={14} /> Accept
                  </button>
                  <button className="suggestion-reject-btn" onClick={(e) => { e.stopPropagation(); handleReject(s.id); }}>
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default memo(SuggestionsSidebar);
