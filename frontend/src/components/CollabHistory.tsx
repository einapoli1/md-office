import React, { useState, useEffect, useRef } from 'react';
import { getInitials } from '../utils/collabColors';

export interface ActivityEvent {
  id: string;
  type: 'join' | 'leave' | 'edit' | 'comment';
  user: string;
  userColor: string;
  timestamp: number;
  detail?: string; // e.g. "edited paragraph 3", "added a comment"
}

interface CollabHistoryProps {
  provider: any;
  currentUser: string;
  editor?: any;
  open: boolean;
  onClose: () => void;
}

const CollabHistory: React.FC<CollabHistoryProps> = ({
  provider,
  currentUser,
  editor,
  open,
  onClose,
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const knownUsersRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track join/leave via awareness
  useEffect(() => {
    if (!provider?.awareness) return;

    const update = () => {
      const states = provider.awareness.getStates() as Map<number, any>;
      const currentNames = new Set<string>();
      states.forEach((state: any) => {
        const name = state?.user?.name;
        if (name) currentNames.add(name);
      });

      const now = Date.now();

      // Detect joins
      currentNames.forEach(name => {
        if (!knownUsersRef.current.has(name) && name !== currentUser) {
          const color = getColorForUser(states, name);
          setEvents(prev => [...prev, {
            id: `join-${name}-${now}`,
            type: 'join',
            user: name,
            userColor: color,
            timestamp: now,
            detail: 'joined the document',
          }]);
        }
      });

      // Detect leaves
      knownUsersRef.current.forEach(name => {
        if (!currentNames.has(name) && name !== currentUser) {
          setEvents(prev => {
            const lastJoin = [...prev].reverse().find(e => e.user === name && e.type === 'join');
            return [...prev, {
              id: `leave-${name}-${now}`,
              type: 'leave',
              user: name,
              userColor: lastJoin?.userColor || '#888',
              timestamp: now,
              detail: 'left the document',
            }];
          });
        }
      });

      knownUsersRef.current = currentNames;
    };

    provider.awareness.on('change', update);
    update();
    return () => { provider.awareness.off('change', update); };
  }, [provider, currentUser]);

  // Track document edits (debounced observation via editor updates)
  useEffect(() => {
    if (!editor) return;

    let lastEditUser = '';
    let lastEditTime = 0;
    const DEBOUNCE = 5000; // group edits within 5 seconds

    const handleUpdate = () => {
      if (!provider?.awareness) return;
      const now = Date.now();
      // Find who just edited based on awareness states with recent activity
      const states = provider.awareness.getStates() as Map<number, any>;
      let editUser = currentUser;
      let editColor = '#888';
      states.forEach((state: any) => {
        const user = state?.user;
        if (user?.name && state?.lastActive && now - state.lastActive < 2000) {
          editUser = user.name;
          editColor = user.color || '#888';
        }
      });

      // Debounce same user edits
      if (editUser === lastEditUser && now - lastEditTime < DEBOUNCE) {
        lastEditTime = now;
        return;
      }
      lastEditUser = editUser;
      lastEditTime = now;

      // Try to identify what was edited
      let detail = 'made an edit';
      try {
        const { $from } = editor.state.selection;
        // Find nearest heading above cursor
        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'heading') {
            detail = `edited "${node.textContent.slice(0, 40)}"`;
            break;
          }
        }
        if (detail === 'made an edit') {
          // Use paragraph number approximation
          let paraCount = 0;
          editor.state.doc.forEach((node: any) => {
            paraCount++;
            if (node === $from.parent) {
              detail = `edited paragraph ${paraCount}`;
            }
          });
        }
      } catch {
        // ignore
      }

      setEvents(prev => [...prev, {
        id: `edit-${editUser}-${now}`,
        type: 'edit',
        user: editUser,
        userColor: editColor,
        timestamp: now,
        detail,
      }]);
    };

    editor.on('update', handleUpdate);
    return () => { editor.off('update', handleUpdate); };
  }, [editor, provider, currentUser]);

  // Listen for comment events
  useEffect(() => {
    const handleComment = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const now = Date.now();
      setEvents(prev => [...prev, {
        id: `comment-${currentUser}-${now}`,
        type: 'comment',
        user: currentUser,
        userColor: detail?.color || '#4285F4',
        timestamp: now,
        detail: 'added a comment',
      }]);
    };
    window.addEventListener('comment-add', handleComment);
    return () => window.removeEventListener('comment-add', handleComment);
  }, [currentUser]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (!open) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const iconForType = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'join': return '🟢';
      case 'leave': return '🔴';
      case 'edit': return '✏️';
      case 'comment': return '💬';
    }
  };

  return (
    <div className="collab-history-panel" style={{
      position: 'fixed', right: 0, top: 48, bottom: 0, width: 300,
      background: 'var(--bg-primary, #fff)', borderLeft: '1px solid var(--border-color, #ddd)',
      display: 'flex', flexDirection: 'column', zIndex: 1000, boxShadow: '-2px 0 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #ddd)' }}>
        <strong>Activity</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {events.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', marginTop: 40, fontSize: 13 }}>No activity yet</div>
        )}
        {events.map(event => (
          <div key={event.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '6px 16px', fontSize: 13,
          }}>
            <span style={{ fontSize: 12, marginTop: 2, flexShrink: 0 }}>{iconForType(event.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: event.userColor,
                  color: '#fff', fontSize: 9, display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 600, flexShrink: 0,
                }}>{getInitials(event.user)}</span>
                <span style={{ fontWeight: 500 }}>{event.user === currentUser ? 'You' : event.user.split(' ')[0]}</span>
              </div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 1 }}>{event.detail}</div>
            </div>
            <span style={{ color: '#999', fontSize: 11, flexShrink: 0, marginTop: 2 }}>{formatTime(event.timestamp)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

function getColorForUser(states: Map<number, any>, name: string): string {
  let color = '#888';
  states.forEach((state: any) => {
    if (state?.user?.name === name && state?.user?.color) {
      color = state.user.color;
    }
  });
  return color;
}

export default CollabHistory;
