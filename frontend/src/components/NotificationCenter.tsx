import { useState, useEffect, useRef } from 'react';
import { Bell, Edit3, MessageSquare, AtSign, AlertTriangle, Info, X, CheckCheck } from 'lucide-react';

export type NotificationType = 'edit' | 'comment' | 'mention' | 'system' | 'conflict';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: Date;
  read: boolean;
  /** Optional location in the doc to navigate to */
  targetId?: string;
}

const ICON_MAP: Record<NotificationType, typeof Edit3> = {
  edit: Edit3,
  comment: MessageSquare,
  mention: AtSign,
  system: Info,
  conflict: AlertTriangle,
};

const COLOR_MAP: Record<NotificationType, string> = {
  edit: '#1a73e8',
  comment: '#0d904f',
  mention: '#9334e6',
  system: '#5f6368',
  conflict: '#e6334a',
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Generate mock notifications for demo */
function generateMockNotifications(): AppNotification[] {
  const now = Date.now();
  return [
    { id: 'n1', type: 'edit', message: 'Alice edited Introduction', timestamp: new Date(now - 120000), read: false },
    { id: 'n2', type: 'comment', message: 'Bob commented on page 3', timestamp: new Date(now - 300000), read: false },
    { id: 'n3', type: 'system', message: 'New version saved', timestamp: new Date(now - 600000), read: false },
    { id: 'n4', type: 'conflict', message: 'Merge conflict detected in Chapter 2', timestamp: new Date(now - 900000), read: false },
    { id: 'n5', type: 'mention', message: 'Carol mentioned you in a comment', timestamp: new Date(now - 1800000), read: true },
    { id: 'n6', type: 'edit', message: 'Dave edited Conclusion', timestamp: new Date(now - 3600000), read: true },
    { id: 'n7', type: 'system', message: 'Auto-save completed', timestamp: new Date(now - 7200000), read: true },
  ];
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(generateMockNotifications);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Listen for custom notification events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Partial<AppNotification>;
      const notif: AppNotification = {
        id: `n-${Date.now()}`,
        type: detail.type || 'system',
        message: detail.message || '',
        timestamp: new Date(),
        read: false,
        targetId: detail.targetId,
      };
      setNotifications(prev => [notif, ...prev]);
    };
    window.addEventListener('app-notification', handler);
    return () => window.removeEventListener('app-notification', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClick = (n: AppNotification) => {
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    if (n.targetId) {
      window.dispatchEvent(new CustomEvent('notification-navigate', { detail: { targetId: n.targetId } }));
    }
    setOpen(false);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
          padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center',
          color: 'var(--text-primary, #202124)',
        }}
        className="notification-bell-btn"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, background: '#e6334a', color: '#fff',
            borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, width: 360, maxHeight: 460,
          background: 'var(--bg-surface, #fff)', border: '1px solid var(--border-color, #dadce0)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.15)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--border-color, #dadce0)',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                color: 'var(--pref-accent-color, #1a73e8)', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#5f6368', fontSize: 13 }}>
                No notifications
              </div>
            )}
            {notifications.map(n => {
              const Icon = ICON_MAP[n.type];
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-color, #f1f3f4)',
                    background: n.read ? 'transparent' : 'rgba(26,115,232,.06)',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg, #f1f3f4)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(26,115,232,.06)')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: `${COLOR_MAP[n.type]}18`,
                  }}>
                    <Icon size={16} color={COLOR_MAP[n.type]} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: n.read ? 400 : 500 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: '#5f6368', marginTop: 2 }}>
                      {timeAgo(n.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      color: '#5f6368', flexShrink: 0, borderRadius: 4,
                    }}
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
