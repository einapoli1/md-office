import React, { useState, useEffect, useCallback } from 'react';
import { getInitials, getUserColor } from '../utils/collabColors';

type PermissionLevel = 'owner' | 'editor' | 'commenter' | 'viewer';

interface UserPermission {
  id: string;
  name: string;
  email: string;
  level: PermissionLevel;
  color: string;
}

interface DocSettings {
  allowComments: boolean;
  allowSuggestions: boolean;
  linkAccess: 'none' | 'view' | 'edit';
}

interface PermissionManagerProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  currentUser: string;
}

const STORAGE_KEY = (docId: string) => `md-office-permissions-${docId}`;
const SETTINGS_KEY = (docId: string) => `md-office-doc-settings-${docId}`;

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  owner: 'Owner',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer',
};

const PermissionManager: React.FC<PermissionManagerProps> = ({ open, onClose, documentId, currentUser }) => {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [settings, setSettings] = useState<DocSettings>({ allowComments: true, allowSuggestions: true, linkAccess: 'none' });
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLevel, setInviteLevel] = useState<PermissionLevel>('editor');

  // Load from localStorage
  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY(documentId));
      if (stored) setPermissions(JSON.parse(stored));
      else {
        // Initialize with current user as owner
        const initial: UserPermission[] = [{
          id: '1', name: currentUser, email: `${currentUser.toLowerCase().replace(/\s/g, '.')}@example.com`,
          level: 'owner', color: getUserColor(currentUser),
        }];
        setPermissions(initial);
      }
      const storedSettings = localStorage.getItem(SETTINGS_KEY(documentId));
      if (storedSettings) setSettings(JSON.parse(storedSettings));
    } catch { /* ignore */ }
  }, [open, documentId, currentUser]);

  // Persist
  useEffect(() => {
    if (permissions.length > 0) localStorage.setItem(STORAGE_KEY(documentId), JSON.stringify(permissions));
  }, [permissions, documentId]);
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY(documentId), JSON.stringify(settings));
  }, [settings, documentId]);

  const addUser = useCallback(() => {
    if (!inviteName.trim()) return;
    const exists = permissions.find(p => p.name.toLowerCase() === inviteName.trim().toLowerCase());
    if (exists) return;
    const newUser: UserPermission = {
      id: Date.now().toString(),
      name: inviteName.trim(),
      email: inviteEmail.trim() || `${inviteName.trim().toLowerCase().replace(/\s/g, '.')}@example.com`,
      level: inviteLevel,
      color: getUserColor(inviteName.trim()),
    };
    setPermissions(prev => [...prev, newUser]);
    setInviteName('');
    setInviteEmail('');
  }, [inviteName, inviteEmail, inviteLevel, permissions]);

  const changeLevel = useCallback((id: string, level: PermissionLevel) => {
    setPermissions(prev => prev.map(p => p.id === id ? { ...p, level } : p));
  }, []);

  const revokeAccess = useCallback((id: string) => {
    setPermissions(prev => prev.filter(p => p.id !== id));
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary, #fff)', borderRadius: 12, width: 480, maxHeight: '80vh',
          overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Share &amp; Permissions</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Invite section */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            placeholder="Name"
            style={{ flex: 1, minWidth: 100, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
          />
          <input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email (optional)"
            style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
          />
          <select
            value={inviteLevel}
            onChange={e => setInviteLevel(e.target.value as PermissionLevel)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
          >
            <option value="editor">Editor</option>
            <option value="commenter">Commenter</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={addUser}
            style={{ padding: '8px 16px', borderRadius: 6, background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
          >
            Invite
          </button>
        </div>

        {/* User list */}
        <div style={{ marginBottom: 20 }}>
          {permissions.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid var(--border-color, #eee)',
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: '50%', background: p.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>{getInitials(p.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</div>
              </div>
              {p.level === 'owner' ? (
                <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>Owner</span>
              ) : (
                <>
                  <select
                    value={p.level}
                    onChange={e => changeLevel(p.id, e.target.value as PermissionLevel)}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd' }}
                  >
                    {(Object.keys(LEVEL_LABELS) as PermissionLevel[]).filter(l => l !== 'owner').map(l => (
                      <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => revokeAccess(p.id)}
                    style={{ background: 'none', border: 'none', color: '#EA4335', cursor: 'pointer', fontSize: 12 }}
                    title="Revoke access"
                  >✕</button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Document settings */}
        <div style={{ borderTop: '1px solid var(--border-color, #ddd)', paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>Document Settings</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.allowComments}
              onChange={e => setSettings(s => ({ ...s, allowComments: e.target.checked }))}
            />
            Allow comments
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.allowSuggestions}
              onChange={e => setSettings(s => ({ ...s, allowSuggestions: e.target.checked }))}
            />
            Allow suggestions
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span>Anyone with link can:</span>
            <select
              value={settings.linkAccess}
              onChange={e => setSettings(s => ({ ...s, linkAccess: e.target.value as DocSettings['linkAccess'] }))}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd' }}
            >
              <option value="none">No access</option>
              <option value="view">View</option>
              <option value="edit">Edit</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionManager;
