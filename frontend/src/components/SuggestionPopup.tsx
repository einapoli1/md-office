import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X } from 'lucide-react';

interface SuggestionPopupProps {
  editor: any;
}

interface PopupState {
  visible: boolean;
  x: number;
  y: number;
  suggestionId: string;
  suggestionType: string;
  author: string;
  text: string;
}

const SuggestionPopup: React.FC<SuggestionPopupProps> = ({ editor }) => {
  const [popup, setPopup] = useState<PopupState>({
    visible: false, x: 0, y: 0, suggestionId: '', suggestionType: '', author: '', text: '',
  });
  const popupRef = useRef<HTMLDivElement>(null);

  // Find all positions of a suggestion mark by ID
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

  const handleAccept = useCallback(() => {
    if (!editor || !popup.suggestionId) return;
    const range = findSuggestionRange(popup.suggestionId);
    if (!range) return;

    const { tr } = editor.state;
    if (range.type === 'insert') {
      // Accept insert: just remove the suggestion mark, keep the text
      tr.removeMark(range.from, range.to, editor.schema.marks.suggestion);
    } else {
      // Accept delete: remove the marked text
      tr.delete(range.from, range.to);
    }
    editor.view.dispatch(tr);
    setPopup(p => ({ ...p, visible: false }));
  }, [editor, popup.suggestionId, findSuggestionRange]);

  const handleReject = useCallback(() => {
    if (!editor || !popup.suggestionId) return;
    const range = findSuggestionRange(popup.suggestionId);
    if (!range) return;

    const { tr } = editor.state;
    if (range.type === 'insert') {
      // Reject insert: remove the text entirely
      tr.delete(range.from, range.to);
    } else {
      // Reject delete: just remove the suggestion mark, keep the text
      tr.removeMark(range.from, range.to, editor.schema.marks.suggestion);
    }
    editor.view.dispatch(tr);
    setPopup(p => ({ ...p, visible: false }));
  }, [editor, popup.suggestionId, findSuggestionRange]);

  // Listen for suggestion clicks
  useEffect(() => {
    const handleClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.suggestionId || !editor) return;

      // Find the DOM element for this suggestion
      const el = editor.view.dom.querySelector(
        `[data-suggestion-id="${detail.suggestionId}"]`
      );
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const editorRect = editor.view.dom.closest('.document-editor')?.getBoundingClientRect() 
        || editor.view.dom.getBoundingClientRect();

      setPopup({
        visible: true,
        x: rect.left - editorRect.left,
        y: rect.bottom - editorRect.top + 4,
        suggestionId: detail.suggestionId,
        suggestionType: el.getAttribute('data-suggestion-type') || 'insert',
        author: el.getAttribute('data-suggestion-author') || 'Guest',
        text: el.textContent || '',
      });
    };

    window.addEventListener('suggestion-click', handleClick);
    return () => window.removeEventListener('suggestion-click', handleClick);
  }, [editor]);

  // Close on outside click
  useEffect(() => {
    if (!popup.visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(p => ({ ...p, visible: false }));
      }
    };
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popup.visible]);

  if (!popup.visible) return null;

  return (
    <div
      ref={popupRef}
      className="suggestion-popup"
      style={{ left: popup.x, top: popup.y }}
    >
      <div className="suggestion-popup-header">
        <span className="suggestion-popup-author">{popup.author}</span>
        <span className={`suggestion-popup-type ${popup.suggestionType}`}>
          {popup.suggestionType === 'insert' ? 'Added' : 'Deleted'}
        </span>
      </div>
      <div className="suggestion-popup-text">
        {popup.suggestionType === 'insert' ? (
          <span className="suggestion-preview-insert">{popup.text}</span>
        ) : (
          <span className="suggestion-preview-delete">{popup.text}</span>
        )}
      </div>
      <div className="suggestion-popup-actions">
        <button className="suggestion-accept-btn" onClick={handleAccept} title="Accept">
          <Check size={14} /> Accept
        </button>
        <button className="suggestion-reject-btn" onClick={handleReject} title="Reject">
          <X size={14} /> Reject
        </button>
      </div>
    </div>
  );
};

export default SuggestionPopup;
