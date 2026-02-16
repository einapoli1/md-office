import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getInitials } from '../utils/collabColors';

interface ChatMessage {
  id: string;
  author: string;
  authorColor: string;
  text: string;
  timestamp: number;
  /** JSON pointer or text anchor in the doc */
  docRef?: { from: number; to: number; preview: string };
  reactions: Record<string, string[]>; // emoji → list of user names
}

interface CollabChatProps {
  provider: any;
  currentUser: string;
  currentUserColor: string;
  editor?: any;
  open: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];

/** Check if two messages are from the same author within 2 minutes */
function isSameGroup(prev: ChatMessage, curr: ChatMessage): boolean {
  return prev.author === curr.author && curr.timestamp - prev.timestamp < 120_000;
}

const CollabChat: React.FC<CollabChatProps> = ({
  provider,
  currentUser,
  currentUserColor,
  editor,
  open,
  onClose,
  onUnreadChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [collaborators, setCollaborators] = useState<{ name: string; color: string }[]>([]);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync collaborators from awareness
  useEffect(() => {
    if (!provider?.awareness) return;
    const update = () => {
      const states = provider.awareness.getStates() as Map<number, any>;
      const seen = new Map<string, { name: string; color: string }>();
      states.forEach((state: any) => {
        const user = state?.user;
        if (user?.name) seen.set(user.name, { name: user.name, color: user.color || '#888' });
      });
      setCollaborators(Array.from(seen.values()));
    };
    provider.awareness.on('change', update);
    update();
    return () => { provider.awareness.off('change', update); };
  }, [provider]);

  // Broadcast / receive via awareness meta field 'chat'
  useEffect(() => {
    if (!provider?.awareness) return;

    const handler = () => {
      const states = provider.awareness.getStates() as Map<number, any>;
      const all: ChatMessage[] = [];
      states.forEach((state: any) => {
        if (state?.chatMessages) {
          (state.chatMessages as ChatMessage[]).forEach(m => {
            if (!all.find(x => x.id === m.id)) all.push(m);
          });
        }
      });
      all.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(prev => {
        if (all.length > prev.length && !open) {
          const diff = all.length - prev.length;
          setUnread(u => u + diff);
        }
        return all;
      });
    };

    provider.awareness.on('change', handler);
    handler();
    return () => { provider.awareness.off('change', handler); };
  }, [provider, open]);

  // Notify parent of unread count
  useEffect(() => {
    onUnreadChange?.(unread);
  }, [unread, onUnreadChange]);

  // Reset unread when opened
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const broadcastMessages = useCallback((msgs: ChatMessage[]) => {
    if (!provider?.awareness) return;
    const local = provider.awareness.getLocalState() || {};
    provider.awareness.setLocalState({ ...local, chatMessages: msgs });
  }, [provider]);

  const send = useCallback(() => {
    if (!draft.trim()) return;
    const msg: ChatMessage = {
      id: `${currentUser}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: currentUser,
      authorColor: currentUserColor,
      text: draft.trim(),
      timestamp: Date.now(),
      reactions: {},
    };
    const next = [...messages, msg];
    setMessages(next);
    broadcastMessages(next);
    setDraft('');
    setMentionQuery(null);
  }, [draft, currentUser, currentUserColor, messages, broadcastMessages]);

  const sendWithDocRef = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const preview = editor.state.doc.textBetween(from, to, ' ').slice(0, 80);
    const msg: ChatMessage = {
      id: `${currentUser}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: currentUser,
      authorColor: currentUserColor,
      text: draft.trim() || '📌 Linked selection',
      timestamp: Date.now(),
      docRef: { from, to, preview },
      reactions: {},
    };
    const next = [...messages, msg];
    setMessages(next);
    broadcastMessages(next);
    setDraft('');
  }, [editor, draft, currentUser, currentUserColor, messages, broadcastMessages]);

  const jumpToRef = useCallback((ref: { from: number; to: number }) => {
    if (!editor) return;
    try {
      editor.chain().focus().setTextSelection(ref).scrollIntoView().run();
    } catch {
      // position may have shifted
    }
  }, [editor]);

  const toggleReaction = useCallback((msgId: string, emoji: string) => {
    setMessages(prev => {
      const next = prev.map(m => {
        if (m.id !== msgId) return m;
        const users = m.reactions[emoji] || [];
        const has = users.includes(currentUser);
        return {
          ...m,
          reactions: {
            ...m.reactions,
            [emoji]: has ? users.filter(u => u !== currentUser) : [...users, currentUser],
          },
        };
      });
      broadcastMessages(next);
      return next;
    });
    setShowEmojiFor(null);
  }, [currentUser, broadcastMessages]);

  // Mention autocomplete
  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);
    const match = val.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const mentionCandidates = mentionQuery !== null
    ? collaborators.filter(c => c.name !== currentUser && c.name.toLowerCase().includes(mentionQuery))
    : [];

  const completeMention = (name: string) => {
    setDraft(d => d.replace(/@\w*$/, `@${name} `));
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionCandidates.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); completeMention(mentionCandidates[mentionIndex].name); return; }
    }
    // Enter sends, Shift+Enter adds newline
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!open) return null;

  return (
    <div className="collab-chat-panel" style={{
      position: 'fixed', right: 0, top: 48, bottom: 0, width: 320,
      background: 'var(--bg-primary, #fff)', borderLeft: '1px solid var(--border-color, #ddd)',
      display: 'flex', flexDirection: 'column', zIndex: 1000, boxShadow: '-2px 0 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #ddd)' }}>
        <strong>Chat</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {messages.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>No messages yet. Start a conversation!</div>
        )}
        {messages.map((msg, idx) => {
          const prev = idx > 0 ? messages[idx - 1] : null;
          const grouped = prev ? isSameGroup(prev, msg) : false;
          return (
            <div key={msg.id} style={{ marginBottom: grouped ? 2 : 12, marginTop: grouped ? 0 : (idx > 0 ? 4 : 0) }}>
              {/* Show avatar/name only for first in group */}
              {!grouped && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: msg.authorColor,
                    color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                  }}>{getInitials(msg.author)}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{msg.author}</span>
                  <span style={{ color: '#999', fontSize: 11 }}>{formatTime(msg.timestamp)}</span>
                </div>
              )}
              <div style={{ marginLeft: 30, fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                {msg.text}
              </div>
              {msg.docRef && (
                <div
                  onClick={() => jumpToRef(msg.docRef!)}
                  style={{
                    marginLeft: 30, marginTop: 4, padding: '4px 8px', background: 'var(--bg-secondary, #f5f5f5)',
                    borderRadius: 4, fontSize: 12, cursor: 'pointer', borderLeft: `3px solid ${msg.authorColor}`,
                    color: '#555', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title="Click to jump to this location"
                >
                  📌 &ldquo;{msg.docRef.preview}&rdquo;
                </div>
              )}
              <div style={{ marginLeft: 30, display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {Object.entries(msg.reactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    style={{
                      fontSize: 12, padding: '1px 6px', borderRadius: 10,
                      border: users.includes(currentUser) ? '1px solid #4285F4' : '1px solid #ddd',
                      background: users.includes(currentUser) ? 'rgba(66,133,244,0.1)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    title={users.join(', ')}
                  >
                    {emoji} {users.length}
                  </button>
                ))}
                <button
                  onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5 }}
                  title="Add reaction"
                >😀</button>
                {showEmojiFor === msg.id && (
                  <div style={{ display: 'flex', gap: 2, background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '2px 4px', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}>
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} onClick={() => toggleReaction(msg.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #ddd)', padding: '8px 12px' }}>
        {mentionCandidates.length > 0 && (
          <div style={{ marginBottom: 4, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', maxHeight: 120, overflowY: 'auto' }}>
            {mentionCandidates.map((c, i) => (
              <div
                key={c.name}
                onClick={() => completeMention(c.name)}
                style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                  background: i === mentionIndex ? 'rgba(66,133,244,0.1)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: c.color, color: '#fff', fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{getInitials(c.name)}</span>
                {c.name}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={onTextChange}
            onKeyDown={onKeyDown}
            placeholder="Type a message… (@mention)"
            rows={1}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd',
              fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit',
              maxHeight: 80, overflowY: 'auto',
            }}
          />
          <button onClick={send} style={{ padding: '8px 12px', borderRadius: 6, background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, alignSelf: 'flex-end' }}>Send</button>
        </div>
        <button
          onClick={sendWithDocRef}
          style={{ marginTop: 4, background: 'none', border: 'none', color: '#4285F4', fontSize: 12, cursor: 'pointer', padding: 0 }}
          title="Attach current text selection to the message"
        >
          📌 Link to selection
        </button>
      </div>
    </div>
  );
};

export default CollabChat;
