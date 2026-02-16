import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getInitials } from '../utils/collabColors';

interface CursorInfo {
  clientId: number;
  name: string;
  color: string;
  cursor: { anchor: number; head: number } | null;
  lastActive: number;
  trail: { x: number; y: number; t: number }[];
}

interface CollabCursorsProps {
  provider: any;
  currentUser: string;
  editor?: any;
  onFollowUser?: (name: string | null) => void;
}

const IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes
const TRAIL_DURATION = 2000;

const CollabCursors: React.FC<CollabCursorsProps> = ({ provider, currentUser, editor, onFollowUser }) => {
  const [cursors, setCursors] = useState<CursorInfo[]>([]);
  const [followingUser, setFollowingUser] = useState<string | null>(null);
  const trailsRef = useRef<Map<string, { x: number; y: number; t: number }[]>>(new Map());

  useEffect(() => {
    if (!provider?.awareness) return;

    const update = () => {
      const states = provider.awareness.getStates() as Map<number, any>;
      const now = Date.now();
      const result: CursorInfo[] = [];

      states.forEach((state: any, clientId: number) => {
        const user = state?.user;
        if (!user?.name || user.name === currentUser) return;
        const cursor = state?.cursor || null;
        const lastActive = state?.lastActive || now;

        // Update trail
        if (cursor && editor) {
          try {
            const coords = editor.view.coordsAtPos(cursor.head);
            const trail = trailsRef.current.get(user.name) || [];
            trail.push({ x: coords.left, y: coords.top, t: now });
            // Keep only recent trail points
            const filtered = trail.filter(p => now - p.t < TRAIL_DURATION);
            trailsRef.current.set(user.name, filtered);
          } catch {
            // position may be out of range
          }
        }

        result.push({
          clientId,
          name: user.name,
          color: user.color || '#888',
          cursor,
          lastActive,
          trail: trailsRef.current.get(user.name) || [],
        });
      });

      setCursors(result);
    };

    provider.awareness.on('change', update);
    update();

    // Broadcast activity
    const activityInterval = setInterval(() => {
      const local = provider.awareness.getLocalState() || {};
      provider.awareness.setLocalState({ ...local, lastActive: Date.now() });
    }, 30000);

    return () => {
      provider.awareness.off('change', update);
      clearInterval(activityInterval);
    };
  }, [provider, currentUser, editor]);

  // Follow mode: scroll to followed user's cursor
  useEffect(() => {
    if (!followingUser || !editor) return;
    const interval = setInterval(() => {
      const target = cursors.find(c => c.name === followingUser);
      if (target?.cursor) {
        try {
          const coords = editor.view.coordsAtPos(target.cursor.head);
          const editorEl = editor.view.dom.closest('.ProseMirror')?.parentElement;
          if (editorEl) {
            editorEl.scrollTo({ top: coords.top - editorEl.clientHeight / 3, behavior: 'smooth' });
          }
        } catch {
          // ignore
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [followingUser, cursors, editor]);

  const toggleFollow = useCallback((name: string) => {
    const next = followingUser === name ? null : name;
    setFollowingUser(next);
    onFollowUser?.(next);
  }, [followingUser, onFollowUser]);

  const now = Date.now();
  const totalViewers = cursors.length + 1; // +1 for current user

  return (
    <>
      {/* Toolbar indicator */}
      <div className="collab-cursors-indicator" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', marginLeft: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34A853', display: 'inline-block' }} />
        {totalViewers} viewing
      </div>

      {/* Cursor labels overlay */}
      {cursors.map(c => {
        if (!c.cursor || !editor) return null;
        const isIdle = now - c.lastActive > IDLE_TIMEOUT;
        let coords: { top: number; left: number } | null = null;
        try {
          coords = editor.view.coordsAtPos(c.cursor.head);
        } catch {
          return null;
        }
        if (!coords) return null;

        const editorRect = editor.view.dom.getBoundingClientRect();
        const top = coords.top - editorRect.top;
        const left = coords.left - editorRect.left;

        return (
          <React.Fragment key={c.clientId}>
            {/* Cursor flag */}
            <div
              style={{
                position: 'absolute',
                top: top - 20,
                left,
                pointerEvents: 'auto',
                zIndex: 50,
                opacity: isIdle ? 0.4 : 1,
                transition: 'opacity 0.5s',
              }}
            >
              <div
                onClick={() => toggleFollow(c.name)}
                style={{
                  background: c.color,
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: '3px 3px 3px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: followingUser === c.name ? '2px solid #fff' : 'none',
                  boxShadow: followingUser === c.name ? `0 0 0 2px ${c.color}` : 'none',
                }}
                title={`${c.name}${isIdle ? ' (idle)' : ''}${followingUser === c.name ? ' — following' : ' — click to follow'}`}
              >
                {getInitials(c.name)} {c.name.split(' ')[0]}
                {followingUser === c.name && ' 👁'}
                {isIdle && ' 💤'}
              </div>
            </div>

            {/* Cursor line */}
            <div
              style={{
                position: 'absolute',
                top,
                left,
                width: 2,
                height: 20,
                background: c.color,
                opacity: isIdle ? 0.3 : 0.8,
                pointerEvents: 'none',
                zIndex: 49,
                transition: 'opacity 0.5s',
              }}
            />

            {/* Trail effect */}
            {c.trail.filter(p => now - p.t < TRAIL_DURATION).map((p, i) => (
              <div
                key={i}
                style={{
                  position: 'fixed',
                  left: p.x,
                  top: p.y,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: c.color,
                  opacity: Math.max(0, 0.3 * (1 - (now - p.t) / TRAIL_DURATION)),
                  pointerEvents: 'none',
                  zIndex: 48,
                }}
              />
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default CollabCursors;
