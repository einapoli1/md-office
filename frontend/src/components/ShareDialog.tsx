import React, { useState } from 'react';
import { X, Link2, Check, Globe, Lock, ChevronDown } from 'lucide-react';
import { toast } from './Toast';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentName?: string;
}

interface SharedUser {
  email: string;
  permission: 'viewer' | 'commenter' | 'editor';
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, onClose, documentName }) => {
  const [emailInput, setEmailInput] = useState('');
  const [permission, setPermission] = useState<'viewer' | 'commenter' | 'editor'>('viewer');
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [anyoneWithLink, setAnyoneWithLink] = useState(false);
  const [linkPermission, setLinkPermission] = useState<'viewer' | 'commenter' | 'editor'>('viewer');
  const [copied, setCopied] = useState(false);
  const [showPermDropdown, setShowPermDropdown] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddUser = () => {
    const email = emailInput.trim();
    if (!email || !email.includes('@')) return;
    if (sharedUsers.some(u => u.email === email)) return;
    setSharedUsers(prev => [...prev, { email, permission }]);
    setEmailInput('');
    toast(`Shared with ${email}`, 'success');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddUser();
  };

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('collab', '1');
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      toast('Link copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRemoveUser = (email: string) => {
    setSharedUsers(prev => prev.filter(u => u.email !== email));
  };

  const handleChangeUserPermission = (email: string, perm: 'viewer' | 'commenter' | 'editor') => {
    setSharedUsers(prev => prev.map(u => u.email === email ? { ...u, permission: perm } : u));
    setShowPermDropdown(null);
  };

  const permLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="share-dialog-header">
          <h3>Share "{documentName || 'Untitled Document'}"</h3>
          <button className="dialog-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Add people */}
        <div className="share-dialog-body">
          <div className="share-input-row">
            <input
              type="email"
              className="share-email-input"
              placeholder="Add people by email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <select
              className="share-perm-select"
              value={permission}
              onChange={e => setPermission(e.target.value as any)}
            >
              <option value="viewer">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="editor">Editor</option>
            </select>
            <button className="share-add-btn" onClick={handleAddUser} disabled={!emailInput.trim()}>
              Share
            </button>
          </div>

          {/* Shared users list */}
          {sharedUsers.length > 0 && (
            <div className="share-users-list">
              <div className="share-section-label">People with access</div>
              {sharedUsers.map(user => (
                <div key={user.email} className="share-user-row">
                  <div className="share-user-avatar">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="share-user-info">
                    <span className="share-user-email">{user.email}</span>
                  </div>
                  <div className="share-user-perm-wrapper">
                    <button
                      className="share-user-perm-btn"
                      onClick={() => setShowPermDropdown(showPermDropdown === user.email ? null : user.email)}
                    >
                      {permLabel(user.permission)} <ChevronDown size={12} />
                    </button>
                    {showPermDropdown === user.email && (
                      <div className="share-perm-dropdown">
                        {(['viewer', 'commenter', 'editor'] as const).map(p => (
                          <button key={p} className="share-perm-option" onClick={() => handleChangeUserPermission(user.email, p)}>
                            {permLabel(p)}
                          </button>
                        ))}
                        <div className="share-perm-divider" />
                        <button className="share-perm-option share-remove" onClick={() => { handleRemoveUser(user.email); setShowPermDropdown(null); }}>
                          Remove access
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* General access */}
          <div className="share-link-section">
            <div className="share-section-label">General access</div>
            <div className="share-link-access-row">
              <div className="share-link-icon-wrapper">
                {anyoneWithLink ? <Globe size={18} /> : <Lock size={18} />}
              </div>
              <div className="share-link-info">
                <button
                  className="share-link-toggle-btn"
                  onClick={() => setAnyoneWithLink(!anyoneWithLink)}
                >
                  {anyoneWithLink ? 'Anyone with the link' : 'Restricted'}
                  <ChevronDown size={12} />
                </button>
                <span className="share-link-desc">
                  {anyoneWithLink
                    ? `Anyone on the internet with the link can ${linkPermission === 'editor' ? 'edit' : linkPermission === 'commenter' ? 'comment' : 'view'}`
                    : 'Only people with access can open the link'}
                </span>
              </div>
              {anyoneWithLink && (
                <select
                  className="share-link-perm-select"
                  value={linkPermission}
                  onChange={e => setLinkPermission(e.target.value as any)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="commenter">Commenter</option>
                  <option value="editor">Editor</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="share-dialog-footer">
          <button className="share-copy-link-btn" onClick={handleCopyLink}>
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button className="share-done-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
