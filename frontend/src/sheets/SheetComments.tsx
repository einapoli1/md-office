import { useState, useRef, useEffect } from 'react';
import type { CellComment, CommentReply } from './sheetModel';

interface SheetCommentsProps {
  cellId: string;
  comment: CellComment | undefined;
  anchorRect: { top: number; left: number; width: number; height: number } | null;
  onAddComment: (cellId: string, text: string) => void;
  onReply: (cellId: string, text: string) => void;
  onResolve: (cellId: string) => void;
  onDelete: (cellId: string) => void;
  onDeleteReply: (cellId: string, replyIndex: number) => void;
  onClose: () => void;
}

export default function SheetComments({
  cellId: cId,
  comment,
  anchorRect,
  onAddComment,
  onReply,
  onResolve,
  onDelete,
  onDeleteReply,
  onClose,
}: SheetCommentsProps) {
  const [text, setText] = useState('');
  const [replyText, setReplyText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!anchorRect) return null;

  const top = anchorRect.top;
  const left = anchorRect.left + anchorRect.width + 4;

  return (
    <div
      ref={panelRef}
      className="sheet-comment-panel"
      style={{ position: 'absolute', top, left, zIndex: 100 }}
      onClick={e => e.stopPropagation()}
    >
      {comment ? (
        <>
          <div className="sheet-comment-header">
            <span className="sheet-comment-author">{comment.author}</span>
            <span className="sheet-comment-time">{new Date(comment.timestamp).toLocaleString()}</span>
            <div className="sheet-comment-actions">
              <button title="Resolve" onClick={() => onResolve(cId)}>✓</button>
              <button title="Delete" onClick={() => onDelete(cId)}>✕</button>
            </div>
          </div>
          <div className="sheet-comment-text">{comment.text}</div>

          {comment.replies.map((r: CommentReply, i: number) => (
            <div key={i} className="sheet-comment-reply">
              <div className="sheet-comment-reply-header">
                <span className="sheet-comment-author">{r.author}</span>
                <span className="sheet-comment-time">{new Date(r.timestamp).toLocaleString()}</span>
                <button className="sheet-comment-delete-reply" title="Delete reply" onClick={() => onDeleteReply(cId, i)}>✕</button>
              </div>
              <div className="sheet-comment-text">{r.text}</div>
            </div>
          ))}

          <div className="sheet-comment-reply-box">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Reply…"
              onKeyDown={e => {
                if (e.key === 'Enter' && replyText.trim()) {
                  onReply(cId, replyText.trim());
                  setReplyText('');
                }
              }}
            />
            <button
              disabled={!replyText.trim()}
              onClick={() => { onReply(cId, replyText.trim()); setReplyText(''); }}
            >Reply</button>
          </div>
        </>
      ) : (
        <div className="sheet-comment-new">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
          />
          <div className="sheet-comment-new-actions">
            <button onClick={onClose}>Cancel</button>
            <button
              className="sheet-comment-submit"
              disabled={!text.trim()}
              onClick={() => { onAddComment(cId, text.trim()); setText(''); }}
            >Comment</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tooltip shown on hover over a comment indicator */
export function CommentTooltip({ comment, style }: { comment: CellComment; style: React.CSSProperties }) {
  return (
    <div className="sheet-comment-tooltip" style={style}>
      <strong>{comment.author}</strong>
      <span className="sheet-comment-tooltip-time">{new Date(comment.timestamp).toLocaleString()}</span>
      <p>{comment.text}</p>
      {comment.replies.length > 0 && (
        <div className="sheet-comment-tooltip-replies">
          {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'}
        </div>
      )}
    </div>
  );
}
