import { useState, useCallback } from 'react';

export interface CommentReply {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

export interface SlideComment {
  id: string;
  x: number;
  y: number;
  author: string;
  text: string;
  timestamp: number;
  replies: CommentReply[];
  resolved: boolean;
}

interface CommentPinsProps {
  comments: SlideComment[];
  onPinClick: (id: string) => void;
  showResolved: boolean;
}

/** Numbered pins rendered on the slide canvas */
export function CommentPins({ comments, onPinClick, showResolved }: CommentPinsProps) {
  const visible = comments.filter(c => showResolved || !c.resolved);
  return (
    <>
      {visible.map((c, i) => (
        <div
          key={c.id}
          className={`comment-pin ${c.resolved ? 'comment-pin-resolved' : ''}`}
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
          onClick={e => { e.stopPropagation(); onPinClick(c.id); }}
          title={c.text}
        >
          {i + 1}
        </div>
      ))}
    </>
  );
}

interface Props {
  comments: SlideComment[];
  onChange: (comments: SlideComment[]) => void;
  currentUser: string;
}

export default function SlideComments({ comments, onChange, currentUser }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const visible = comments.filter(c => showResolved || !c.resolved);
  const active = comments.find(c => c.id === activeId);

  const handleResolve = useCallback((id: string) => {
    onChange(comments.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c));
  }, [comments, onChange]);

  const handleDelete = useCallback((id: string) => {
    onChange(comments.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  }, [comments, onChange, activeId]);

  const handleReply = useCallback(() => {
    if (!active || !replyText.trim()) return;
    const reply: CommentReply = {
      id: `reply-${Date.now()}`,
      author: currentUser,
      text: replyText.trim(),
      timestamp: Date.now(),
    };
    onChange(comments.map(c => c.id === active.id ? { ...c, replies: [...c.replies, reply] } : c));
    setReplyText('');
  }, [active, replyText, currentUser, comments, onChange]);

  const handleDeleteReply = useCallback((commentId: string, replyId: string) => {
    onChange(comments.map(c => c.id === commentId ? { ...c, replies: c.replies.filter(r => r.id !== replyId) } : c));
  }, [comments, onChange]);

  const fmtTime = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="slide-comments-panel">
      <div className="comments-header">
        <h4>Comments ({visible.length})</h4>
        <label className="comments-show-resolved">
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
          Show resolved
        </label>
      </div>

      <div className="comments-list">
        {visible.map((c, i) => (
          <div
            key={c.id}
            className={`comment-item ${c.id === activeId ? 'comment-item-active' : ''} ${c.resolved ? 'comment-item-resolved' : ''}`}
            onClick={() => setActiveId(c.id === activeId ? null : c.id)}
          >
            <div className="comment-item-header">
              <span className="comment-pin-badge">{i + 1}</span>
              <span className="comment-author">{c.author}</span>
              <span className="comment-time">{fmtTime(c.timestamp)}</span>
            </div>
            <div className="comment-text">{c.text}</div>

            {c.id === activeId && (
              <div className="comment-thread">
                {c.replies.map(r => (
                  <div key={r.id} className="comment-reply">
                    <div className="comment-reply-header">
                      <span className="comment-author">{r.author}</span>
                      <span className="comment-time">{fmtTime(r.timestamp)}</span>
                      {r.author === currentUser && (
                        <button className="btn-icon btn-danger" onClick={e => { e.stopPropagation(); handleDeleteReply(c.id, r.id); }}>×</button>
                      )}
                    </div>
                    <div className="comment-text">{r.text}</div>
                  </div>
                ))}
                <div className="comment-reply-input">
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Reply…"
                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                    onClick={e => e.stopPropagation()}
                  />
                  <button onClick={e => { e.stopPropagation(); handleReply(); }}>↵</button>
                </div>
                <div className="comment-actions">
                  <button onClick={e => { e.stopPropagation(); handleResolve(c.id); }}>
                    {c.resolved ? '↩ Reopen' : '✓ Resolve'}
                  </button>
                  <button className="btn-danger" onClick={e => { e.stopPropagation(); handleDelete(c.id); }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && <div className="comments-empty">Click on the slide to add a comment</div>}
      </div>
    </div>
  );
}
