import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getInitials } from '../utils/collabColors';

interface EditEntry {
  id: string;
  user: string;
  userColor: string;
  action: string; // "added paragraph", "deleted text", "formatted text", etc.
  timestamp: number;
  /** Doc positions affected */
  from: number;
  to: number;
}

interface EditHistoryProps {
  provider: any;
  editor?: any;
  currentUser: string;
  currentUserColor: string;
  open: boolean;
  onClose: () => void;
}

/** Group rapid edits by same user within 30s */
function groupEdits(entries: EditEntry[]): EditEntry[][] {
  const groups: EditEntry[][] = [];
  let current: EditEntry[] = [];

  for (const e of entries) {
    if (current.length === 0) {
      current.push(e);
    } else {
      const last = current[current.length - 1];
      if (last.user === e.user && e.timestamp - last.timestamp < 30000) {
        current.push(e);
      } else {
        groups.push(current);
        current = [e];
      }
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

const EditHistory: React.FC<EditHistoryProps> = ({ provider, editor, currentUser, currentUserColor, open, onClose }) => {
  const [entries, setEntries] = useState<EditEntry[]>([]);
  const [replaying, setReplaying] = useState(false);
  const replayRef = useRef(false);

  // Track edits via editor transactions
  useEffect(() => {
    if (!editor) return;

    const handler = ({ transaction }: { transaction: any }) => {
      if (!transaction.docChanged) return;
      const steps = transaction.steps;
      if (!steps || steps.length === 0) return;

      // Determine action description
      let action = 'edited text';
      let from = 0;
      let to = 0;

      try {
        const step = steps[0];
        const map = step.getMap();
        map.forEach((_oldStart: number, _oldEnd: number, newStart: number, newEnd: number) => {
          from = newStart;
          to = newEnd;
        });

        if (step.slice && step.slice.content) {
          const content = step.slice.content;
          const firstChild = content.firstChild;
          if (firstChild) {
            if (firstChild.type.name === 'paragraph') action = 'added paragraph';
            else if (firstChild.type.name === 'table') action = 'added table';
            else if (firstChild.type.name === 'heading') action = 'added heading';
            else if (firstChild.type.name === 'image') action = 'inserted image';
            else if (content.size > 20) action = 'added text block';
            else action = 'added text';
          }
        }
        if (step.from !== undefined && step.to !== undefined && (!step.slice || step.slice.content.size === 0)) {
          action = 'deleted text';
        }
      } catch {
        // fallback
      }

      // Get user from awareness
      let user = currentUser;
      let color = currentUserColor;
      if (provider?.awareness) {
        const states = provider.awareness.getStates() as Map<number, any>;
        // Check if transaction has a clientID
        const meta = transaction.getMeta('y-sync$');
        if (meta && meta.isChangeOrigin) {
          // Remote change - try to identify
          states.forEach((state: any) => {
            if (state?.user?.name && state.user.name !== currentUser) {
              user = state.user.name;
              color = state.user.color || '#888';
            }
          });
        }
      }

      const entry: EditEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user,
        userColor: color,
        action,
        timestamp: Date.now(),
        from,
        to,
      };

      setEntries(prev => [...prev.slice(-200), entry]); // Keep last 200
    };

    editor.on('transaction', handler);
    return () => { editor.off('transaction', handler); };
  }, [editor, provider, currentUser, currentUserColor]);

  // Broadcast entries via awareness
  useEffect(() => {
    if (!provider?.awareness || entries.length === 0) return;
    const local = provider.awareness.getLocalState() || {};
    provider.awareness.setLocalState({ ...local, editHistory: entries.slice(-50) });
  }, [entries, provider]);

  // Merge remote entries
  useEffect(() => {
    if (!provider?.awareness) return;
    const handler = () => {
      const states = provider.awareness.getStates() as Map<number, any>;
      const all = new Map<string, EditEntry>();
      states.forEach((state: any) => {
        if (state?.editHistory) {
          (state.editHistory as EditEntry[]).forEach(e => {
            if (!all.has(e.id)) all.set(e.id, e);
          });
        }
      });
      const sorted = Array.from(all.values()).sort((a, b) => a.timestamp - b.timestamp);
      setEntries(sorted.slice(-200));
    };
    provider.awareness.on('change', handler);
    return () => { provider.awareness.off('change', handler); };
  }, [provider]);

  const highlightRegion = useCallback((from: number, to: number) => {
    if (!editor) return;
    try {
      editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();
    } catch {
      // positions may have shifted
    }
  }, [editor]);

  const startReplay = useCallback(async () => {
    if (!editor || entries.length === 0) return;
    setReplaying(true);
    replayRef.current = true;

    for (const entry of entries) {
      if (!replayRef.current) break;
      try {
        editor.chain().focus().setTextSelection({ from: entry.from, to: Math.min(entry.to, editor.state.doc.content.size) }).scrollIntoView().run();
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 800));
    }

    setReplaying(false);
    replayRef.current = false;
  }, [editor, entries]);

  const stopReplay = useCallback(() => {
    replayRef.current = false;
    setReplaying(false);
  }, []);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!open) return null;

  const groups = groupEdits(entries);

  return (
    <div style={{
      position: 'fixed', right: 0, top: 48, bottom: 0, width: 320,
      background: 'var(--bg-primary, #fff)', borderLeft: '1px solid var(--border-color, #ddd)',
      display: 'flex', flexDirection: 'column', zIndex: 1000, boxShadow: '-2px 0 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #ddd)' }}>
        <strong>Edit Activity</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!replaying ? (
            <button
              onClick={startReplay}
              style={{ background: '#4285F4', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
              disabled={entries.length === 0}
            >▶ Replay</button>
          ) : (
            <button
              onClick={stopReplay}
              style={{ background: '#EA4335', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
            >⏹ Stop</button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {groups.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>No edits recorded yet.</div>
        )}
        {groups.slice().reverse().map((group, gi) => {
          const first = group[0];
          const last = group[group.length - 1];
          const summary = group.length === 1
            ? `${first.action}`
            : `${group.length} edits`;
          return (
            <div
              key={gi}
              onClick={() => highlightRegion(first.from, last.to)}
              style={{
                display: 'flex', gap: 8, padding: '8px 4px', cursor: 'pointer',
                borderBottom: '1px solid var(--border-color, #f0f0f0)',
                borderRadius: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary, #f9f9f9)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%', background: first.userColor,
                color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0,
              }}>{getInitials(first.user)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{first.user}</strong> {summary}
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  {formatTime(first.timestamp)}{group.length > 1 && ` – ${formatTime(last.timestamp)}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EditHistory;
