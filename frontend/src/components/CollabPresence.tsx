import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getInitials } from '../utils/collabColors';

interface CollabUser {
  clientId: number;
  name: string;
  color: string;
  cursor?: { anchor: number; head: number } | null;
}

interface CollabPresenceProps {
  provider: any; // HocuspocusProvider
  currentUser: string;
  editor?: any;
}

const CollabPresence: React.FC<CollabPresenceProps> = ({ provider, currentUser, editor }) => {
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [followingUser, setFollowingUser] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!provider?.awareness) return;

    const update = () => {
      const states = provider.awareness.getStates() as Map<number, any>;
      const seen = new Map<string, CollabUser>();
      states.forEach((state: any, clientId: number) => {
        const user = state?.user;
        if (user?.name && !seen.has(user.name)) {
          seen.set(user.name, {
            clientId,
            name: user.name,
            color: user.color || '#888',
            cursor: state?.cursor || null,
          });
        }
      });
      setUsers(Array.from(seen.values()));
    };

    provider.awareness.on('change', update);
    update();
    return () => { provider.awareness.off('change', update); };
  }, [provider]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  // Follow mode: scroll to followed user's cursor periodically
  useEffect(() => {
    if (!followingUser || !editor) return;
    const interval = setInterval(() => {
      if (!provider?.awareness) return;
      const states = provider.awareness.getStates() as Map<number, any>;
      let targetCursor: { anchor: number; head: number } | null = null;
      states.forEach((state: any) => {
        if (state?.user?.name === followingUser && state?.cursor) {
          targetCursor = state.cursor;
        }
      });
      if (targetCursor) {
        try {
          const coords = editor.view.coordsAtPos((targetCursor as { head: number }).head);
          const editorEl = editor.view.dom.closest('.ProseMirror')?.parentElement;
          if (editorEl) {
            editorEl.scrollTo({ top: coords.top - editorEl.clientHeight / 3, behavior: 'smooth' });
          }
        } catch {
          // position may be out of range
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [followingUser, editor, provider]);

  const jumpToCursor = useCallback((user: CollabUser) => {
    if (!editor || !user.cursor) return;
    try {
      const coords = editor.view.coordsAtPos(user.cursor.head);
      const editorEl = editor.view.dom.closest('.ProseMirror')?.parentElement;
      if (editorEl) {
        editorEl.scrollTo({ top: coords.top - editorEl.clientHeight / 3, behavior: 'smooth' });
      }
    } catch {
      // ignore
    }
  }, [editor]);

  const toggleFollow = useCallback((name: string) => {
    setFollowingUser(prev => prev === name ? null : name);
  }, []);

  // Don't show if alone
  if (users.length <= 1) return null;

  const others = users.filter(u => u.name !== currentUser);
  const maxShow = 4;
  const visible = others.slice(0, maxShow);
  const overflow = others.length - maxShow;

  return (
    <div className="collab-presence" ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {/* Following indicator */}
      {followingUser && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 12, fontSize: 11,
          background: 'rgba(66,133,244,0.1)', color: '#4285F4', fontWeight: 600,
        }}>
          👁 Following {followingUser.split(' ')[0]}
          <button
            onClick={() => setFollowingUser(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#4285F4', padding: 0 }}
            title="Stop following"
          >✕</button>
        </div>
      )}

      {/* Avatar row */}
      {visible.map(user => (
        <div
          key={user.name}
          className="collab-avatar"
          style={{
            backgroundColor: user.color,
            cursor: 'pointer',
            border: followingUser === user.name ? '2px solid #fff' : '2px solid transparent',
            boxShadow: followingUser === user.name ? `0 0 0 2px ${user.color}` : 'none',
          }}
          title={`${user.name} — click to follow`}
          onClick={() => toggleFollow(user.name)}
        >
          {getInitials(user.name)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="collab-avatar collab-avatar-overflow"
          title={`${overflow} more`}
          onClick={() => setShowDropdown(!showDropdown)}
          style={{ cursor: 'pointer' }}
        >
          +{overflow}
        </div>
      )}

      {/* Dropdown toggle */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
          color: '#666', padding: '2px 4px',
        }}
        title="Show all users"
      >▾</button>

      {/* User list dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-color, #ddd)',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 1000,
          minWidth: 220, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color, #ddd)', fontSize: 12, fontWeight: 600, color: '#666' }}>
            {users.length} user{users.length !== 1 ? 's' : ''} online
          </div>
          {users.map(user => {
            const isMe = user.name === currentUser;
            const isFollowing = followingUser === user.name;
            return (
              <div key={user.name} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                borderBottom: '1px solid var(--border-color, #f0f0f0)',
                background: isFollowing ? 'rgba(66,133,244,0.05)' : 'transparent',
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', background: user.color,
                  color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 600, flexShrink: 0,
                }}>
                  {getInitials(user.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}{isMe ? ' (you)' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34A853' }} />
                    <span style={{ fontSize: 11, color: '#999' }}>Online</span>
                  </div>
                </div>
                {!isMe && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {user.cursor && (
                      <button
                        onClick={() => jumpToCursor(user)}
                        title="Jump to cursor"
                        style={{
                          background: 'none', border: '1px solid #ddd', borderRadius: 4,
                          cursor: 'pointer', fontSize: 12, padding: '2px 6px', color: '#666',
                        }}
                      >↗</button>
                    )}
                    <button
                      onClick={() => toggleFollow(user.name)}
                      title={isFollowing ? 'Stop following' : 'Follow user'}
                      style={{
                        background: isFollowing ? '#4285F4' : 'none',
                        color: isFollowing ? '#fff' : '#666',
                        border: isFollowing ? 'none' : '1px solid #ddd', borderRadius: 4,
                        cursor: 'pointer', fontSize: 12, padding: '2px 6px',
                      }}
                    >{isFollowing ? '👁 Following' : '👁'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollabPresence;
