import React, { useState, useMemo, useCallback } from 'react';
import { GitCommit } from '../types';
import { X, RotateCcw, Clock, ChevronRight, Tag, Check } from 'lucide-react';

interface VersionHistoryProps {
  commits: GitCommit[];
  onRevert: (commit: GitCommit) => void;
  onPreview: (commit: GitCommit) => void;
  onClose: () => void;
  selectedCommit: GitCommit | null;
  previewContent: string | null;
  currentContent: string;
  isLoading?: boolean;
  onNameVersion?: (commit: GitCommit, name: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Word-level diff for Google Docs-style inline highlights            */
/* ------------------------------------------------------------------ */

interface DiffSegment {
  type: 'same' | 'added' | 'removed' | 'modified-old' | 'modified-new';
  text: string;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/);
}

function computeWordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const segments: DiffSegment[] = [];

  const m = oldTokens.length;
  const n = newTokens.length;

  // For very large docs, fall back to line-based
  if (m * n > 2_000_000) {
    if (oldText) segments.push({ type: 'removed', text: oldText });
    if (newText) segments.push({ type: 'added', text: newText });
    return segments;
  }

  // LCS on tokens
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldTokens[i - 1] === newTokens[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const ops: DiffSegment[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      ops.push({ type: 'same', text: oldTokens[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', text: newTokens[j - 1] });
      j--;
    } else {
      ops.push({ type: 'removed', text: oldTokens[i - 1] });
      i--;
    }
  }

  return ops.reverse();
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function groupByDate(commits: GitCommit[]): { label: string; commits: GitCommit[] }[] {
  const groups: Map<string, GitCommit[]> = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const c of commits) {
    const d = new Date(c.date);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = 'Today';
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
    else label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(c);
  }
  return Array.from(groups.entries()).map(([label, commits]) => ({ label, commits }));
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  commits,
  onRevert,
  onPreview,
  onClose,
  selectedCommit,
  previewContent,
  currentContent,
  isLoading,
  onNameVersion,
}) => {
  const [viewMode, setViewMode] = useState<'inline' | 'raw'>('inline');
  const [namingCommit, setNamingCommit] = useState<string | null>(null);
  const [versionName, setVersionName] = useState('');
  const grouped = useMemo(() => groupByDate(commits), [commits]);

  const diffSegments = useMemo(() => {
    if (!selectedCommit || previewContent === null) return null;
    return computeWordDiff(previewContent, currentContent);
  }, [selectedCommit, previewContent, currentContent]);

  const stats = useMemo(() => {
    if (!diffSegments) return null;
    let added = 0, removed = 0;
    for (const seg of diffSegments) {
      if (seg.type === 'added') added++;
      if (seg.type === 'removed') removed++;
    }
    return { added, removed };
  }, [diffSegments]);

  const isAutoSave = (msg: string) => msg.startsWith('Update ') || msg === 'Auto-save';

  const handleNameVersion = useCallback((commit: GitCommit) => {
    if (!versionName.trim()) return;
    onNameVersion?.(commit, versionName.trim());
    setNamingCommit(null);
    setVersionName('');
  }, [versionName, onNameVersion]);

  return (
    <div className="vh-sidebar">
      {/* Header */}
      <div className="vh-header">
        <h3>Version history</h3>
        <button className="vh-close-btn" onClick={onClose} title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Diff area */}
      {selectedCommit && (
        <div className="vh-diff-section">
          <div className="vh-diff-header">
            <span className="vh-diff-title">
              {selectedCommit.message || 'Auto-save'}
            </span>
            <div className="vh-diff-actions">
              <div className="vh-view-toggle">
                <button
                  className={`vh-view-btn ${viewMode === 'inline' ? 'active' : ''}`}
                  onClick={() => setViewMode('inline')}
                >
                  Inline
                </button>
                <button
                  className={`vh-view-btn ${viewMode === 'raw' ? 'active' : ''}`}
                  onClick={() => setViewMode('raw')}
                >
                  Raw
                </button>
              </div>
              <button
                className="vh-restore-btn"
                onClick={() => {
                  if (confirm(`Restore this version?\n\n${selectedCommit.message}\n${new Date(selectedCommit.date).toLocaleString()}`)) {
                    onRevert(selectedCommit);
                  }
                }}
              >
                <RotateCcw size={14} />
                Restore this version
              </button>
            </div>
          </div>

          {stats && (
            <div className="vh-diff-stats">
              <span className="vh-stat-added">+{stats.added} added</span>
              <span className="vh-stat-removed">-{stats.removed} removed</span>
            </div>
          )}

          {viewMode === 'inline' && diffSegments && (
            <div className="vh-inline-diff">
              {diffSegments.length === 0 && (
                <div className="vh-diff-empty">No changes in this version</div>
              )}
              {diffSegments.map((seg, i) => {
                if (seg.type === 'same') {
                  return <span key={i} className="vh-diff-same">{seg.text}</span>;
                }
                if (seg.type === 'added') {
                  return <span key={i} className="vh-diff-added">{seg.text}</span>;
                }
                if (seg.type === 'removed') {
                  return <span key={i} className="vh-diff-removed">{seg.text}</span>;
                }
                return <span key={i}>{seg.text}</span>;
              })}
            </div>
          )}

          {viewMode === 'raw' && diffSegments && (
            <div className="vh-diff-view">
              {diffSegments.filter(s => s.type !== 'same').map((seg, i) => (
                <div
                  key={i}
                  className={`vh-diff-line vh-diff-${seg.type === 'added' ? 'added' : 'removed'}`}
                >
                  <span className="vh-diff-prefix">
                    {seg.type === 'added' ? '+' : '−'}
                  </span>
                  <span className="vh-diff-text">{seg.text || '\u00a0'}</span>
                </div>
              ))}
              {diffSegments.filter(s => s.type !== 'same').length === 0 && (
                <div className="vh-diff-empty">No changes in this version</div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="vh-diff-loading">Loading version...</div>
          )}
        </div>
      )}

      {/* Version list (timeline) */}
      <div className="vh-list">
        {commits.length === 0 ? (
          <div className="vh-empty">
            <Clock size={32} />
            <p>No version history yet</p>
            <p className="vh-empty-sub">Versions are created each time you save</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label} className="vh-group">
              <div className="vh-group-label">{group.label}</div>
              {group.commits.map(commit => {
                const isSelected = selectedCommit?.hash === commit.hash;
                const auto = isAutoSave(commit.message);
                const isNaming = namingCommit === commit.hash;
                return (
                  <div key={commit.hash} className="vh-item-wrapper">
                    <div className="vh-timeline-dot" />
                    <button
                      className={`vh-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => onPreview(commit)}
                    >
                      <div className="vh-item-left">
                        <ChevronRight size={14} className={`vh-chevron ${isSelected ? 'open' : ''}`} />
                        <div className="vh-item-info">
                          <span className={`vh-item-message ${auto ? 'auto' : 'named'}`}>
                            {commit.message || 'Auto-save'}
                          </span>
                          <span className="vh-item-meta">
                            {formatRelativeDate(commit.date)}
                            {commit.author && ` · ${commit.author}`}
                          </span>
                        </div>
                      </div>
                      <span className="vh-item-hash">{commit.hash.slice(0, 7)}</span>
                    </button>
                    {isSelected && (
                      <div className="vh-item-actions">
                        {isNaming ? (
                          <div className="vh-name-input-row">
                            <input
                              className="vh-name-input"
                              placeholder="Version name..."
                              value={versionName}
                              onChange={e => setVersionName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleNameVersion(commit); if (e.key === 'Escape') setNamingCommit(null); }}
                              autoFocus
                            />
                            <button className="vh-name-confirm" onClick={() => handleNameVersion(commit)}>
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="vh-name-btn"
                            onClick={(e) => { e.stopPropagation(); setNamingCommit(commit.hash); setVersionName(''); }}
                            title="Name this version"
                          >
                            <Tag size={12} />
                            Name this version
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VersionHistory;
