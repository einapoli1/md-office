import React, { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Send, Trash2, Check, Reply } from 'lucide-react';

export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  resolved: boolean;
  replies: CommentReply[];
  /** The highlighted text this comment refers to */
  quotedText?: string;
}

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

interface CommentsSidebarProps {
  comments: Comment[];
  activeCommentId: string | null;
  onAddReply: (commentId: string, text: string) => void;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onSelectComment: (commentId: string) => void;
  onClose: () => void;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
};

const CommentsSidebar: React.FC<CommentsSidebarProps> = ({
  comments,
  activeCommentId,
  onAddReply,
  onResolve,
  onDelete,
  onSelectComment,
  onClose,
}) => {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeCommentId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCommentId]);

  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyingTo]);

  const handleReply = (commentId: string) => {
    if (!replyText.trim()) return;
    onAddReply(commentId, replyText.trim());
    setReplyText('');
    setReplyingTo(null);
  };

  const openComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  return (
    <div className="comments-sidebar">
      <div className="comments-sidebar-header">
        <div className="comments-sidebar-title">
          <MessageSquare size={16} />
          <span>Comments ({openComments.length})</span>
        </div>
        <button className="comments-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="comments-list">
        {openComments.length === 0 && resolvedComments.length === 0 && (
          <div className="comments-empty">
            <MessageSquare size={32} strokeWidth={1.5} />
            <p>No comments yet</p>
            <p className="comments-empty-hint">Select text and click the comment button to add one</p>
          </div>
        )}

        {openComments.map(comment => (
          <div
            key={comment.id}
            ref={comment.id === activeCommentId ? activeRef : undefined}
            className={`comment-card ${comment.id === activeCommentId ? 'active' : ''}`}
            onClick={() => onSelectComment(comment.id)}
          >
            {comment.quotedText && (
              <div className="comment-quoted-text">"{comment.quotedText}"</div>
            )}
            <div className="comment-header">
              <span className="comment-author">{comment.author}</span>
              <span className="comment-time">{formatTime(comment.createdAt)}</span>
            </div>
            <div className="comment-body">{comment.text}</div>

            {/* Replies */}
            {comment.replies.map(reply => (
              <div key={reply.id} className="comment-reply">
                <div className="comment-header">
                  <span className="comment-author">{reply.author}</span>
                  <span className="comment-time">{formatTime(reply.createdAt)}</span>
                </div>
                <div className="comment-body">{reply.text}</div>
              </div>
            ))}

            {/* Reply input */}
            {replyingTo === comment.id ? (
              <div className="comment-reply-input">
                <textarea
                  ref={replyInputRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Reply..."
                  rows={2}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleReply(comment.id);
                    }
                    if (e.key === 'Escape') {
                      setReplyingTo(null);
                      setReplyText('');
                    }
                  }}
                />
                <div className="comment-reply-actions">
                  <button onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</button>
                  <button className="primary" onClick={() => handleReply(comment.id)}>
                    <Send size={12} /> Reply
                  </button>
                </div>
              </div>
            ) : (
              <div className="comment-actions">
                <button onClick={(e) => { e.stopPropagation(); setReplyingTo(comment.id); }} title="Reply">
                  <Reply size={14} /> Reply
                </button>
                <button onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }} title="Resolve">
                  <Check size={14} /> Resolve
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }} title="Delete" className="danger">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}

        {resolvedComments.length > 0 && (
          <>
            <div className="comments-section-divider">
              Resolved ({resolvedComments.length})
            </div>
            {resolvedComments.map(comment => (
              <div key={comment.id} className="comment-card resolved">
                <div className="comment-header">
                  <span className="comment-author">{comment.author}</span>
                  <span className="comment-time">{formatTime(comment.createdAt)}</span>
                </div>
                <div className="comment-body">{comment.text}</div>
                <div className="comment-actions">
                  <button onClick={() => onDelete(comment.id)} className="danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default CommentsSidebar;
