import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Check, AlertTriangle, ChevronDown, Settings, X } from 'lucide-react';

interface AutoSaveProps {
  content: string;
  activeFilePath?: string | null;
  onSave: (commitMessage?: string) => Promise<void>;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSaved?: Date;
}

interface SaveEntry {
  time: Date;
  message: string;
  auto: boolean;
}

function generateCommitMessage(oldContent: string, newContent: string): string {
  if (!oldContent && newContent) return 'Created new document';
  if (oldContent && !newContent) return 'Cleared document content';

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const added = newLines.filter(l => !oldLines.includes(l));
  const removed = oldLines.filter(l => !newLines.includes(l));

  // Check for heading changes
  const newHeadings = added.filter(l => l.startsWith('#'));
  if (newHeadings.length > 0) {
    const heading = newHeadings[0].replace(/^#+\s*/, '');
    return `Added section: ${heading.slice(0, 50)}`;
  }

  // Check for table changes
  if (added.some(l => l.includes('|') && l.includes('-'))) return 'Updated table content';

  // Check for list changes
  if (added.some(l => /^\s*[-*]\s/.test(l))) return 'Updated list items';

  const netAdded = added.length - removed.length;
  if (netAdded > 5) return `Added ${netAdded} lines of content`;
  if (netAdded < -5) return `Removed ${Math.abs(netAdded)} lines of content`;
  if (added.length > 0) return `Edited ${added.length} line${added.length > 1 ? 's' : ''}`;

  return 'Minor edits';
}

const INTERVALS = [
  { label: '1 min', value: 1 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
];

const AutoSave: React.FC<AutoSaveProps> = ({ content, activeFilePath, onSave, saveStatus, lastSaved }) => {
  const [interval, setInterval_] = useState(() => {
    const saved = localStorage.getItem('md-office-autosave-interval');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem('md-office-autosave-enabled') !== 'false';
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [saveHistory, setSaveHistory] = useState<SaveEntry[]>([]);
  const lastContentRef = useRef(content);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-save timer
  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      if (lastContentRef.current !== content && activeFilePath) {
        const msg = generateCommitMessage(lastContentRef.current, content);
        try {
          await onSave(msg);
          setSaveHistory(prev => [{ time: new Date(), message: msg, auto: true }, ...prev].slice(0, 20));
          lastContentRef.current = content;
        } catch { /* error handled by parent */ }
      }
    }, interval * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [enabled, interval, content, activeFilePath, onSave]);

  // Cmd+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          setShowCommitDialog(true);
        } else {
          handleManualSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleManualSave = useCallback(async () => {
    const msg = generateCommitMessage(lastContentRef.current, content);
    try {
      await onSave(msg);
      setSaveHistory(prev => [{ time: new Date(), message: msg, auto: false }, ...prev].slice(0, 20));
      lastContentRef.current = content;
    } catch { /* handled by parent */ }
  }, [content, onSave]);

  const handleCommitWithMessage = async () => {
    const msg = customMessage.trim() || generateCommitMessage(lastContentRef.current, content);
    try {
      await onSave(msg);
      setSaveHistory(prev => [{ time: new Date(), message: msg, auto: false }, ...prev].slice(0, 20));
      lastContentRef.current = content;
      setShowCommitDialog(false);
      setCustomMessage('');
    } catch { /* handled */ }
  };

  const updateInterval = (val: number) => {
    setInterval_(val);
    localStorage.setItem('md-office-autosave-interval', String(val));
  };

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('md-office-autosave-enabled', String(next));
  };

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving': return <div className="as-spinner" />;
      case 'error': return <AlertTriangle size={12} style={{ color: '#d93025' }} />;
      case 'saved': return <Check size={12} style={{ color: '#137333' }} />;
      default: return <Save size={12} style={{ color: '#5f6368' }} />;
    }
  };

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'error': return 'Error';
      case 'saved': return lastSaved ? formatTime(lastSaved) : 'Saved';
      default: return 'Unsaved';
    }
  };

  return (
    <>
      <div className="as-container" ref={dropdownRef}>
        <button className="as-trigger" onClick={() => setShowDropdown(!showDropdown)} title="Save status & history">
          {getStatusIcon()}
          <span className="as-status-text">{getStatusText()}</span>
          <ChevronDown size={10} />
        </button>

        {showDropdown && (
          <div className="as-dropdown">
            {/* Quick actions */}
            <div className="as-section">
              <button className="as-action" onClick={handleManualSave}>
                <Save size={14} /> Save now <span className="as-shortcut">⌘S</span>
              </button>
              <button className="as-action" onClick={() => { setShowCommitDialog(true); setShowDropdown(false); }}>
                <Save size={14} /> Save with message... <span className="as-shortcut">⌘⇧S</span>
              </button>
              <button className="as-action" onClick={() => setShowSettings(!showSettings)}>
                <Settings size={14} /> Auto-save settings
              </button>
            </div>

            {/* Settings */}
            {showSettings && (
              <div className="as-section as-settings">
                <label className="as-toggle-row">
                  <span>Auto-save</span>
                  <button className={`as-toggle-switch ${enabled ? 'on' : ''}`} onClick={toggleEnabled}>
                    <span className="as-toggle-knob" />
                  </button>
                </label>
                {enabled && (
                  <div className="as-interval">
                    <span style={{ fontSize: 12, color: '#5f6368' }}>Save every:</span>
                    <div className="as-interval-btns">
                      {INTERVALS.map(opt => (
                        <button
                          key={opt.value}
                          className={`as-interval-btn ${interval === opt.value ? 'active' : ''}`}
                          onClick={() => updateInterval(opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save history */}
            {saveHistory.length > 0 && (
              <div className="as-section">
                <div className="as-section-title">Recent saves</div>
                {saveHistory.slice(0, 8).map((entry, i) => (
                  <div key={i} className="as-history-item">
                    <div className="as-history-dot" />
                    <div className="as-history-info">
                      <span className="as-history-msg">{entry.message}</span>
                      <span className="as-history-time">
                        {formatTime(entry.time)} {entry.auto && <span className="as-auto-badge">auto</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom commit message dialog */}
      {showCommitDialog && (
        <div className="as-dialog-overlay" onClick={() => setShowCommitDialog(false)}>
          <div className="as-dialog" onClick={e => e.stopPropagation()}>
            <div className="as-dialog-header">
              <h4 style={{ margin: 0 }}>Save with message</h4>
              <button className="as-dialog-close" onClick={() => setShowCommitDialog(false)}><X size={16} /></button>
            </div>
            <input
              className="as-dialog-input"
              placeholder={generateCommitMessage(lastContentRef.current, content)}
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCommitWithMessage(); }}
              autoFocus
            />
            <div className="as-dialog-actions">
              <button className="as-dialog-btn as-dialog-primary" onClick={handleCommitWithMessage}>Save</button>
              <button className="as-dialog-btn" onClick={() => setShowCommitDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .as-container { position: relative; }
        .as-trigger {
          display: flex; align-items: center; gap: 4; padding: 2px 8px;
          border: none; background: transparent; cursor: pointer; font-size: 11px;
          color: #5f6368; border-radius: 4px;
        }
        .as-trigger:hover { background: rgba(0,0,0,0.06); }
        .as-status-text { white-space: nowrap; }
        .as-spinner {
          width: 12px; height: 12px; border: 2px solid #dadce0; border-top-color: #1a73e8;
          border-radius: 50%; animation: as-spin 0.8s linear infinite;
        }
        @keyframes as-spin { to { transform: rotate(360deg); } }
        .as-dropdown {
          position: absolute; bottom: 100%; left: 0; margin-bottom: 4px;
          background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          min-width: 260px; z-index: 1001; overflow: hidden;
        }
        .as-section { padding: 8px 0; border-bottom: 1px solid #e8eaed; }
        .as-section:last-child { border-bottom: none; }
        .as-section-title { font-size: 11px; color: #5f6368; text-transform: uppercase; padding: 4px 16px 6px; letter-spacing: 0.5px; }
        .as-action {
          display: flex; align-items: center; gap: 8; padding: 8px 16px; border: none;
          background: none; width: 100%; text-align: left; cursor: pointer; font-size: 13px; color: #3c4043;
        }
        .as-action:hover { background: #f1f3f4; }
        .as-shortcut { margin-left: auto; font-size: 11px; color: #80868b; }
        .as-settings { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
        .as-toggle-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .as-toggle-switch {
          width: 36px; height: 20px; border-radius: 10px; border: none;
          background: #dadce0; position: relative; cursor: pointer; transition: background 0.2s;
        }
        .as-toggle-switch.on { background: #1a73e8; }
        .as-toggle-knob {
          position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
          border-radius: 50%; background: #fff; transition: left 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .as-toggle-switch.on .as-toggle-knob { left: 18px; }
        .as-interval { display: flex; flex-direction: column; gap: 6px; }
        .as-interval-btns { display: flex; gap: 4px; }
        .as-interval-btn {
          padding: 4px 10px; border: 1px solid #dadce0; border-radius: 6px;
          background: #fff; font-size: 12px; cursor: pointer; color: #5f6368;
        }
        .as-interval-btn.active { background: #e8f0fe; color: #1a73e8; border-color: #1a73e8; }
        .as-history-item { display: flex; gap: 8; padding: 4px 16px; align-items: flex-start; }
        .as-history-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #dadce0; margin-top: 5px; flex-shrink: 0;
        }
        .as-history-info { display: flex; flex-direction: column; min-width: 0; }
        .as-history-msg { font-size: 12px; color: #3c4043; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .as-history-time { font-size: 10px; color: #80868b; }
        .as-auto-badge { background: #f1f3f4; padding: 0 4px; border-radius: 3px; font-size: 9px; }
        .as-dialog-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1100;
          display: flex; align-items: center; justify-content: center;
        }
        .as-dialog {
          background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          width: 400px; padding: 20px;
        }
        .as-dialog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .as-dialog-close { border: none; background: none; cursor: pointer; color: #5f6368; }
        .as-dialog-input {
          width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px;
          font-size: 14px; outline: none; box-sizing: border-box;
        }
        .as-dialog-input:focus { border-color: #1a73e8; }
        .as-dialog-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
        .as-dialog-btn {
          padding: 8px 20px; border: 1px solid #dadce0; border-radius: 6px;
          background: #fff; font-size: 13px; cursor: pointer;
        }
        .as-dialog-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
      `}</style>
    </>
  );
};

export default AutoSave;
